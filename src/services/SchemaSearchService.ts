import type { ConnectionProfile, ObjectRef } from "../core/types";
import type { SchemaService } from "./SchemaService";

export interface SchemaSearchHit {
  kind: "table" | "view" | "column";
  schema?: string;
  table: string;
  column?: string;
}

/** Số bảng tối đa quét cột để tránh quá nhiều round-trip. */
const COLUMN_SCAN_CAP = 150;

/** Tìm kiếm table/view/column theo tên trong một connection (global search). */
export class SchemaSearchService {
  constructor(private readonly schemaService: SchemaService) {}

  async search(
    profile: ConnectionProfile,
    schema: string | undefined,
    term: string
  ): Promise<SchemaSearchHit[]> {
    const needle = term.trim().toLowerCase();
    if (!needle) {
      return [];
    }
    const [tables, views] = await Promise.all([
      this.schemaService.listTables(profile, schema).catch(() => []),
      this.schemaService.listViews(profile, schema).catch(() => [])
    ]);
    const hits: SchemaSearchHit[] = [];
    for (const table of tables) {
      if (table.name.toLowerCase().includes(needle)) {
        hits.push({ kind: "table", schema: table.schema, table: table.name });
      }
    }
    for (const view of views) {
      if (view.name.toLowerCase().includes(needle)) {
        hits.push({ kind: "view", schema: view.schema, table: view.name });
      }
    }
    // Quét cột (có cap) để tìm theo tên cột.
    const scanList = tables.slice(0, COLUMN_SCAN_CAP);
    const columnResults = await Promise.all(
      scanList.map(async (table) => {
        const ref: ObjectRef = { schema: table.schema, name: table.name };
        const columns = await this.schemaService.listColumns(profile, ref).catch(() => []);
        return columns
          .filter((column) => column.name.toLowerCase().includes(needle))
          .map<SchemaSearchHit>((column) => ({
            kind: "column",
            schema: table.schema,
            table: table.name,
            column: column.name
          }));
      })
    );
    for (const list of columnResults) {
      hits.push(...list);
    }
    return hits;
  }
}
