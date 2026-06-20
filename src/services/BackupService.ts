import type { ConnectionProfile } from "../core/types";
import { toSqlInsert } from "../utils/exporters";
import type { ExportService } from "./ExportService";
import type { SchemaService } from "./SchemaService";

export interface BackupProgress {
  current: number;
  total: number;
  table: string;
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
    const tables = await this.schemaService.listTables(profile, schema);
    const quote = await this.exportService.quoteFn(profile);
    const parts: string[] = [
      `-- Open DB Nexus logical backup`,
      `-- connection: ${profile.name} (${profile.dbType})${schema ? ` · schema: ${schema}` : ""}`,
      `-- tables: ${tables.length}`,
      ``
    ];
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const ref = { schema: table.schema ?? schema, name: table.name };
      onProgress?.({ current: i + 1, total: tables.length, table: table.name });
      const ddl = await this.schemaService.getObjectDDL(profile, ref).catch(() => "");
      const fetched = await this.exportService.fetchAll(profile, ref);
      parts.push(`-- ===== ${table.name} =====`);
      if (ddl) {
        parts.push(`${ddl.trim()}${ddl.trim().endsWith(";") ? "" : ";"}`);
      }
      if (fetched.rows.length > 0) {
        parts.push(toSqlInsert(ref, fetched.columns, fetched.rows, quote));
      }
      if (fetched.truncated) {
        parts.push(`-- NOTE: ${table.name} truncated at export cap.`);
      }
      parts.push("");
    }
    return parts.join("\n");
  }
}
