import type { ConnectionProfile, ObjectRef, TableInfo } from "../core/types";
import { toSqlInsert } from "../utils/exporters";
import type { ExportService } from "./ExportService";
import type { SchemaService } from "./SchemaService";

export interface BackupProgress {
  current: number;
  total: number;
  table: string;
}

interface DumpTarget {
  ref: ObjectRef;
  type: TableInfo["type"];
}

/**
 * Logical backup: dump DDL + dữ liệu (INSERT) của các bảng trong một schema ra
 * chuỗi SQL. Không phụ thuộc công cụ ngoài (pg_dump/mysqldump); dùng adapter
 * sẵn có nên chạy trên mọi engine SQL được hỗ trợ. Mỗi bảng giới hạn theo
 * ExportService.fetchAll (cap 50k dòng).
 */
export class BackupService {
  constructor(
    private readonly schemaService: SchemaService,
    private readonly exportService: ExportService
  ) {}

  async backup(
    profile: ConnectionProfile,
    schema: string | undefined,
    onProgress?: (progress: BackupProgress) => void
  ): Promise<string> {
    const targets = await this.collectTargets(profile, schema);
    const tables = targets.filter((target) => target.type === "base_table");
    const views = targets.filter((target) => target.type === "view");
    const quote = await this.exportService.quoteFn(profile);
    const parts: string[] = [
      `-- Open DB Nexus logical backup`,
      `-- connection: ${profile.name} (${profile.dbType})${schema ? ` | schema: ${schema}` : ""}`,
      `-- tables: ${tables.length}`,
      `-- views: ${views.length}`,
      ``
    ];
    const total = targets.length;
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const label = qualifiedName(target.ref);
      onProgress?.({ current: i + 1, total, table: label });
      const ddl = await this.schemaService.getObjectDDL(profile, target.ref).catch(() => "");
      parts.push(`-- ===== ${target.type === "view" ? "VIEW" : "TABLE"} ${label} =====`);
      if (ddl) {
        parts.push(`${ddl.trim()}${ddl.trim().endsWith(";") ? "" : ";"}`);
      }
      if (target.type === "base_table") {
        const fetched = await this.exportService.fetchAll(profile, target.ref);
        if (fetched.rows.length > 0) {
          parts.push(toSqlInsert(target.ref, fetched.columns, fetched.rows, quote));
        }
        if (fetched.truncated) {
          parts.push(`-- NOTE: ${label} truncated at export cap.`);
        }
      }
      parts.push("");
    }
    return parts.join("\n");
  }

  private async collectTargets(
    profile: ConnectionProfile,
    schema: string | undefined
  ): Promise<DumpTarget[]> {
    const schemas =
      schema !== undefined
        ? [schema]
        : await this.schemaService
            .listSchemas(profile)
            .then((items) => items.map((item) => item.name))
            .catch(() => []);

    if (schemas.length === 0) {
      return this.collectTargetsForSchema(profile, undefined);
    }

    const nested = await Promise.all(
      schemas.map((schemaName) => this.collectTargetsForSchema(profile, schemaName))
    );
    return nested.flat();
  }

  private async collectTargetsForSchema(
    profile: ConnectionProfile,
    schema: string | undefined
  ): Promise<DumpTarget[]> {
    const [tables, views] = await Promise.all([
      this.schemaService.listTables(profile, schema),
      this.schemaService.listViews(profile, schema).catch(() => [])
    ]);
    return [
      ...tables.map((table): DumpTarget => ({
        ref: { schema: table.schema ?? schema, name: table.name },
        type: table.type
      })),
      ...views.map((view): DumpTarget => ({
        ref: { schema: view.schema ?? schema, name: view.name },
        type: view.type
      }))
    ];
  }
}

function qualifiedName(ref: ObjectRef): string {
  return ref.schema ? `${ref.schema}.${ref.name}` : ref.name;
}
