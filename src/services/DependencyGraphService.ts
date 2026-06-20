import type {
  ConnectionProfile,
  DependencyGraph,
  ForeignKeyInfo,
  GraphDepth,
  GraphDirection,
  ObjectRef,
  ViewDependency
} from "../core/types";
import {
  appendViewDependencies,
  buildFkGraph,
  buildImpactReport,
  getSubgraph,
  objectId
} from "./graphBuilder";
import type { SchemaService } from "./SchemaService";

const LARGE_GRAPH_THRESHOLD = 300;

/** Dựng dependency graph (FK + view) cho một bảng/đối tượng trung tâm. */
export class DependencyGraphService {
  constructor(private readonly schemaService: SchemaService) {}

  async build(
    profile: ConnectionProfile,
    ref: ObjectRef,
    direction: GraphDirection,
    depth: GraphDepth
  ): Promise<DependencyGraph> {
    const full = await this.buildFullGraph(profile, ref);
    const centerId = objectId(ref.schema, ref.name);
    const depthValue = depth === "all" ? Number.POSITIVE_INFINITY : depth;
    const subgraph = getSubgraph(full, centerId, direction, depthValue);
    if (subgraph.nodes.length > LARGE_GRAPH_THRESHOLD) {
      subgraph.warnings = [
        `Large graph (${subgraph.nodes.length} nodes) — consider lowering depth.`
      ];
    }
    return subgraph;
  }

  /** Báo cáo Markdown impact analysis cho một bảng (dùng toàn bộ graph). */
  async buildReport(profile: ConnectionProfile, ref: ObjectRef): Promise<string> {
    const full = await this.buildFullGraph(profile, ref);
    return buildImpactReport(full, objectId(ref.schema, ref.name));
  }

  /** Dựng graph FK + view cho toàn schema, đảm bảo node trung tâm tồn tại. */
  private async buildFullGraph(
    profile: ConnectionProfile,
    ref: ObjectRef
  ): Promise<DependencyGraph> {
    const schema = ref.schema;
    const tables = await this.schemaService.listTables(profile, schema);

    const fks: ForeignKeyInfo[] = [];
    for (const table of tables) {
      const tableFks = await this.schemaService.listForeignKeys(profile, {
        schema,
        name: table.name
      });
      for (const fk of tableFks) {
        // Giả định FK cùng schema (MVP) -> gán target.schema để node id nhất quán.
        fks.push({ ...fk, target: { ...fk.target, schema: fk.target.schema ?? schema } });
      }
    }

    const views = await this.schemaService.listViews(profile, schema);
    const viewDeps: ViewDependency[] = [];
    for (const view of views) {
      const references = await this.schemaService.listViewDependencies(profile, {
        schema,
        name: view.name
      });
      if (references.length > 0) {
        viewDeps.push({ view: { schema, name: view.name }, references });
      }
    }

    const graph = appendViewDependencies(buildFkGraph(fks), viewDeps);
    const centerId = objectId(schema, ref.name);
    if (!graph.nodes.some((node) => node.id === centerId)) {
      graph.nodes.push({
        id: centerId,
        label: ref.name,
        type: "table",
        schema,
        objectName: ref.name
      });
    }
    return graph;
  }
}
