import type { ConnectionProfile, DbType } from "../core/types";
import type { QueryService } from "./QueryService";
import type { SchemaService } from "./SchemaService";

export interface DashboardMetrics {
  dbType: DbType;
  schema?: string;
  tableCount: number;
  viewCount: number;
  version?: string;
  sizePretty?: string;
}

/** Câu lấy version theo engine (best-effort). */
const VERSION_SQL: Partial<Record<DbType, string>> = {
  postgresql: "SELECT version() AS v",
  mysql: "SELECT version() AS v",
  mariadb: "SELECT version() AS v",
  sqlserver: "SELECT @@VERSION AS v",
  sqlite: "SELECT sqlite_version() AS v"
};

/** Thu thập số liệu tổng quan cho một connection (dashboard). */
export class DashboardService {
  constructor(
    private readonly schemaService: SchemaService,
    private readonly queryService: QueryService
  ) {}

  async collect(profile: ConnectionProfile, schema?: string): Promise<DashboardMetrics> {
    const [tables, views] = await Promise.all([
      this.schemaService.listTables(profile, schema).catch(() => []),
      this.schemaService.listViews(profile, schema).catch(() => [])
    ]);
    const metrics: DashboardMetrics = {
      dbType: profile.dbType,
      schema,
      tableCount: tables.length,
      viewCount: views.length
    };
    const versionSql = VERSION_SQL[profile.dbType];
    if (versionSql) {
      try {
        const result = await this.queryService.execute(profile, versionSql);
        const value = result.rows[0]?.v;
        metrics.version = typeof value === "string" ? value : undefined;
      } catch {
        // version là best-effort; bỏ qua nếu không lấy được.
      }
    }
    return metrics;
  }
}
