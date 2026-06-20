import type {
  ConnectionProfile,
  DependencyGraph,
  ForeignKeyInfo,
  GraphDepth,
  GraphDirection,
  ObjectRef
} from "../core/types";
import { buildFkGraph, getSubgraph, objectId } from "./graphBuilder";
import type { SchemaService } from "./SchemaService";

const LARGE_GRAPH_THRESHOLD = 300;

/** Dựng dependency graph (FK) cho một bảng trung tâm. */
export class DependencyGraphService {
  constructor(private readonly schemaService: SchemaService) {}

  async build(
    profile: ConnectionProfile,
    ref: ObjectRef,
    direction: GraphDirection,
    depth: GraphDepth
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

    const full = buildFkGraph(fks);
    const centerId = objectId(schema, ref.name);
    if (!full.nodes.some((node) => node.id === centerId)) {
      full.nodes.push({
        id: centerId,
        label: ref.name,
        type: "table",
        schema,
        objectName: ref.name
      });
    }

    const depthValue = depth === "all" ? Number.POSITIVE_INFINITY : depth;
    const subgraph = getSubgraph(full, centerId, direction, depthValue);
    if (subgraph.nodes.length > LARGE_GRAPH_THRESHOLD) {
      subgraph.warnings = [
        `Large graph (${subgraph.nodes.length} nodes) — consider lowering depth.`
      ];
    }
    return subgraph;
  }
}
