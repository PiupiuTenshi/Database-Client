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

export function supportsDatabaseVersion(dbType: DbType): boolean {
  return Boolean(VERSION_SQL[dbType]);
}

export function formatDatabaseVersion(value: string, dbType: DbType): string {
  const trimmed = value.trim();
  const numeric = trimmed.match(/\d+(?:\.\d+){1,3}/)?.[0];
  switch (dbType) {
    case "postgresql":
      return numeric ? `PostgreSQL ${numeric}` : trimmed;
    case "mysql":
      return numeric ? `MySQL ${numeric}` : trimmed;
    case "mariadb":
      return numeric ? `MariaDB ${numeric}` : trimmed;
    case "sqlserver": {
      const named = trimmed.match(/SQL Server\s+(\d{4})/i)?.[1];
      return named ? `SQL Server ${named}` : numeric ? `SQL Server ${numeric}` : trimmed;
    }
    case "sqlite":
      return numeric ? `SQLite ${numeric}` : trimmed;
    default:
      return numeric ? `v${numeric}` : trimmed;
  }
}

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
    metrics.version = await this.getVersion(profile);
    return metrics;
  }

  async getVersion(profile: ConnectionProfile): Promise<string | undefined> {
    const versionSql = VERSION_SQL[profile.dbType];
    if (!versionSql) {
      return undefined;
    }
    try {
      const result = await this.queryService.execute(profile, versionSql);
      const firstRow = result.rows[0];
      const value = findVersionValue(firstRow);
      return value ? formatDatabaseVersion(value, profile.dbType) : undefined;
    } catch {
      // version là best-effort; bỏ qua nếu không lấy được.
      return undefined;
    }
  }
}

function findVersionValue(row: Record<string, unknown> | undefined): string | undefined {
  if (!row) {
    return undefined;
  }
  const direct = row.v ?? row.V ?? row.version ?? row.VERSION;
  if (isVersionValue(direct)) {
    return String(direct);
  }
  const value = Object.values(row).find(isVersionValue);
  return value === undefined ? undefined : String(value);
}

function isVersionValue(value: unknown): value is string | number | bigint {
  return typeof value === "string" || typeof value === "number" || typeof value === "bigint";
}
