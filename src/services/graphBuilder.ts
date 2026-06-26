import type {
  DependencyGraph,
  ForeignKeyInfo,
  GraphDirection,
  GraphEdge,
  GraphNode,
  ViewDependency
} from "../core/types";

export function objectId(schema: string | undefined, table: string): string {
  return schema ? `${schema}.${table}` : table;
}

function makeNode(
  id: string,
  schema: string | undefined,
  name: string,
  type: "table" | "view" = "table"
): GraphNode {
  return { id, label: name, type, schema, objectName: name };
}

/** Dựng graph FK đầy đủ từ danh sách ForeignKeyInfo. */
export function buildFkGraph(fks: ForeignKeyInfo[]): DependencyGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  for (const fk of fks) {
    const sourceId = objectId(fk.source.schema, fk.source.table);
    const targetId = objectId(fk.target.schema, fk.target.table);
    nodes.set(sourceId, makeNode(sourceId, fk.source.schema, fk.source.table));
    nodes.set(targetId, makeNode(targetId, fk.target.schema, fk.target.table));
    edges.push({
      id: `fk:${fk.name}:${sourceId}:${targetId}`,
      source: sourceId,
      target: targetId,
      type: "foreign_key",
      label: `${fk.source.columns.join(", ")} → ${fk.target.columns.join(", ")}`,
      sourceColumns: fk.source.columns,
      targetColumns: fk.target.columns
    });
  }

  return { nodes: [...nodes.values()], edges };
}

function buildAdjacency(edges: GraphEdge[], direction: GraphDirection): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  const add = (from: string, to: string): void => {
    const list = adjacency.get(from) ?? [];
    list.push(to);
    adjacency.set(from, list);
  };
  for (const edge of edges) {
    if (direction === "outbound" || direction === "both") {
      add(edge.source, edge.target);
    }
    if (direction === "inbound" || direction === "both") {
      add(edge.target, edge.source);
    }
  }
  return adjacency;
}

/**
 * Lấy subgraph quanh centerId theo direction + depth.
 * depth = Number.POSITIVE_INFINITY nghĩa là "all".
 */
export function getSubgraph(
  graph: DependencyGraph,
  centerId: string,
  direction: GraphDirection,
  depth: number
): DependencyGraph {
  const adjacency = buildAdjacency(graph.edges, direction);
  const visited = new Set<string>([centerId]);
  const queue: { id: string; level: number }[] = [{ id: centerId, level: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.level >= depth) {
      continue;
    }
    for (const next of adjacency.get(current.id) ?? []) {
      if (visited.has(next)) {
        continue;
      }
      visited.add(next);
      queue.push({ id: next, level: current.level + 1 });
    }
  }

  return {
    center: centerId,
    nodes: graph.nodes.filter((node) => visited.has(node.id)),
    edges: graph.edges.filter((edge) => visited.has(edge.source) && visited.has(edge.target))
  };
}

/** Thêm cạnh view_reference (view -> table mà nó tham chiếu) vào graph. */
export function appendViewDependencies(
  graph: DependencyGraph,
  viewDeps: ViewDependency[]
): DependencyGraph {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node] as const));
  const edges = [...graph.edges];

  for (const dep of viewDeps) {
    const viewId = objectId(dep.view.schema, dep.view.name);
    nodes.set(viewId, makeNode(viewId, dep.view.schema, dep.view.name, "view"));
    for (const ref of dep.references) {
      const refId = objectId(ref.schema, ref.name);
      if (!nodes.has(refId)) {
        nodes.set(refId, makeNode(refId, ref.schema, ref.name));
      }
      edges.push({
        id: `view:${viewId}:${refId}`,
        source: viewId,
        target: refId,
        type: "view_reference",
        label: "references"
      });
    }
  }

  return { ...graph, nodes: [...nodes.values()], edges };
}

/**
 * Phát hiện chu trình phụ thuộc (DFS coloring). Trả về danh sách chu trình,
 * mỗi chu trình là chuỗi node id (khép kín, phần tử đầu == cuối).
 */
export function detectCycles(graph: DependencyGraph): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.push(edge.target);
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(graph.nodes.map((n) => [n.id, WHITE]));
  const stack: string[] = [];
  const cycles: string[][] = [];
  const seen = new Set<string>();

  const visit = (id: string): void => {
    color.set(id, GRAY);
    stack.push(id);
    for (const next of adjacency.get(id) ?? []) {
      if (color.get(next) === GRAY) {
        const start = stack.indexOf(next);
        if (start >= 0) {
          const cycle = [...stack.slice(start), next];
          const key = [...cycle].sort().join(",");
          if (!seen.has(key)) {
            seen.add(key);
            cycles.push(cycle);
          }
        }
      } else if (color.get(next) === WHITE) {
        visit(next);
      }
    }
    stack.pop();
    color.set(id, BLACK);
  };

  for (const node of graph.nodes) {
    if (color.get(node.id) === WHITE) {
      visit(node.id);
    }
  }
  return cycles;
}

function labelOf(graph: DependencyGraph, id: string): string {
  return graph.nodes.find((n) => n.id === id)?.label ?? id;
}

/** Sinh báo cáo Markdown impact analysis quanh centerId. */
export function buildImpactReport(graph: DependencyGraph, centerId: string): string {
  const centerLabel = labelOf(graph, centerId);
  const dependsOn = graph.edges.filter((e) => e.source === centerId);
  const dependedOnBy = graph.edges.filter((e) => e.target === centerId);
  const transitiveInbound = getSubgraph(graph, centerId, "inbound", Number.POSITIVE_INFINITY)
    .nodes.map((n) => n.id)
    .filter((id) => id !== centerId);
  const cycles = detectCycles(graph).filter((c) => c.includes(centerId));

  const lines: string[] = [`# Dependency Report: ${centerId}`, ""];

  lines.push(`## ${centerLabel} depends on`, "");
  if (dependsOn.length === 0) {
    lines.push("- (none)");
  } else {
    for (const e of dependsOn) {
      lines.push(`- ${labelOf(graph, e.target)} via \`${e.label ?? e.type}\``);
    }
  }
  lines.push("");

  lines.push(`## Depends on ${centerLabel}`, "");
  if (dependedOnBy.length === 0) {
    lines.push("- (none)");
  } else {
    for (const e of dependedOnBy) {
      lines.push(`- ${labelOf(graph, e.source)} via \`${e.label ?? e.type}\``);
    }
  }
  lines.push("");

  lines.push("## Impact", "");
  if (transitiveInbound.length === 0) {
    lines.push(`Changing \`${centerId}\` has no known dependents.`);
  } else {
    lines.push(`Changing \`${centerId}\` may affect:`);
    for (const id of transitiveInbound) {
      lines.push(`- ${id}`);
    }
  }

  if (cycles.length > 0) {
    lines.push("", "## Circular dependencies", "");
    for (const cycle of cycles) {
      lines.push(`- ${cycle.join(" → ")}`);
    }
  }

  return lines.join("\n") + "\n";
}
