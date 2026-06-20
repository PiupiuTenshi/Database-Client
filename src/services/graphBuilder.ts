import type {
  DependencyGraph,
  ForeignKeyInfo,
  GraphDirection,
  GraphEdge,
  GraphNode
} from "../core/types";

export function objectId(schema: string | undefined, table: string): string {
  return schema ? `${schema}.${table}` : table;
}

function makeNode(id: string, schema: string | undefined, table: string): GraphNode {
  return { id, label: table, type: "table", schema, objectName: table };
}

/** Dựng graph FK đầy đủ từ danh sách ForeignKeyInfo (docs/05 §8). */
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
 * Lấy subgraph quanh centerId theo direction + depth (docs/05 §9).
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
