import type {
  CheckConstraintInfo,
  ColumnInfo,
  DbType,
  ForeignKeyInfo,
  IndexInfo,
  ObjectRef,
  PlaceholderStyle,
  QueryColumn,
  QueryOptions,
  QueryResult,
  RuntimeConnectionProfile,
  SchemaInfo,
  TableInfo,
  TestConnectionResult,
  TriggerInfo
} from "../../core/types";
import { newId } from "../../utils/objectId";
import { quoteIdentifier } from "../../utils/sqlSafety";
import type { PaginationStyle } from "../common/pagination";
import type { DatabaseAdapter, DbSession } from "../DatabaseAdapter";

type HttpRow = Record<string, unknown>;

export interface HttpSqlResult {
  rows: HttpRow[];
  columns?: string[];
  affectedRows?: number;
}

export interface HttpSqlExecutor {
  execute(profile: RuntimeConnectionProfile, sql: string, params?: unknown[]): Promise<HttpSqlResult>;
}

interface HttpSqlAdapterConfig {
  dbType: DbType;
  label: string;
  quote: "double" | "backtick";
  defaultSchema?: string;
  paginationStyle?: PaginationStyle;
  placeholderStyle?: PlaceholderStyle;
  schemasSql?: string;
  tablesSql?: string;
  viewsSql?: string;
  columnsSql?: string;
  indexesSql?: string;
  ddlSql?: string;
}

const defaultExecutor: HttpSqlExecutor = {
  async execute(profile, sql, params) {
    const endpoint = endpointFor(profile);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: headersFor(profile),
      body: JSON.stringify({ sql, params: params ?? [], database: profile.database })
    });
    if (!response.ok) {
      throw new Error(`HTTP SQL request failed: ${response.status} ${response.statusText}`);
    }
    return normalizeHttpSqlPayload(await response.json());
  }
};

export abstract class HttpSqlAdapter implements DatabaseAdapter {
  readonly dbType: DbType;
  readonly paginationStyle: PaginationStyle;
  readonly placeholderStyle: PlaceholderStyle;

  private readonly sessions = new Map<string, RuntimeConnectionProfile>();

  protected constructor(
    private readonly config: HttpSqlAdapterConfig,
    private readonly executor: HttpSqlExecutor = defaultExecutor
  ) {
    this.dbType = config.dbType;
    this.paginationStyle = config.paginationStyle ?? "limit-offset";
    this.placeholderStyle = config.placeholderStyle ?? "qmark";
  }

  quoteIdentifier(name: string): string {
    if (this.config.quote === "backtick") {
      return `\`${name.replace(/`/g, "``")}\``;
    }
    return quoteIdentifier(name);
  }

  async connect(profile: RuntimeConnectionProfile): Promise<DbSession> {
    await this.executor.execute(profile, this.config.schemasSql ? this.config.schemasSql : "SELECT 1");
    const id = newId();
    this.sessions.set(id, profile);
    return { id, dbType: this.dbType };
  }

  async testConnection(profile: RuntimeConnectionProfile): Promise<TestConnectionResult> {
    try {
      await this.executor.execute(profile, "SELECT 1 AS ok");
      return { ok: true, message: `Connected to ${this.config.label} successfully.` };
    } catch (error) {
      return { ok: false, message: toErrorMessage(error) };
    }
  }

  async disconnect(session: DbSession): Promise<void> {
    this.sessions.delete(session.id);
  }

  async listSchemas(session: DbSession): Promise<SchemaInfo[]> {
    if (!this.config.schemasSql) {
      return [];
    }
    const result = await this.run(session, this.config.schemasSql);
    return result.rows.map((row) => ({
      name: firstString(row, ["schema_name", "name", "database", "Database", "catalog_name"]),
      isDefault: firstString(row, ["schema_name", "name", "database"]) === this.config.defaultSchema
    }));
  }

  async listTables(session: DbSession, schema?: string): Promise<TableInfo[]> {
    return this.listObjects(session, this.config.tablesSql, schema, "base_table");
  }

  async listViews(session: DbSession, schema?: string): Promise<TableInfo[]> {
    return this.listObjects(session, this.config.viewsSql, schema, "view");
  }

  async listColumns(session: DbSession, ref: ObjectRef): Promise<ColumnInfo[]> {
    if (!this.config.columnsSql) {
      return [];
    }
    const result = await this.run(session, this.config.columnsSql, ...objectParams(ref, this.config.defaultSchema));
    return result.rows.map((row, index) => ({
      name: firstString(row, ["column_name", "name", "Column", "column"]),
      dataType: firstString(row, ["data_type", "type", "Type", "column_type"]),
      ordinal: firstNumber(row, ["ordinal_position", "position", "column_id"], index + 1),
      nullable: firstString(row, ["is_nullable", "nullable", "Null"]) !== "NO",
      defaultValue: optionalString(row, ["column_default", "default"]),
      isPrimaryKey: false
    }));
  }

  async listIndexes(session: DbSession, ref: ObjectRef): Promise<IndexInfo[]> {
    if (!this.config.indexesSql) {
      return [];
    }
    const result = await this.run(session, this.config.indexesSql, ...objectParams(ref, this.config.defaultSchema));
    return result.rows.map((row) => ({
      name: firstString(row, ["index_name", "name"]),
      unique: Boolean(row.unique),
      columns: splitColumns(row.columns)
    }));
  }

  async listForeignKeys(_session: DbSession, _ref: ObjectRef): Promise<ForeignKeyInfo[]> {
    return [];
  }

  async listTriggers(_session: DbSession, _ref: ObjectRef): Promise<TriggerInfo[]> {
    return [];
  }

  async listCheckConstraints(_session: DbSession, _ref: ObjectRef): Promise<CheckConstraintInfo[]> {
    return [];
  }

  async listViewDependencies(_session: DbSession, _ref: ObjectRef): Promise<ObjectRef[]> {
    return [];
  }

  async getObjectDDL(session: DbSession, ref: ObjectRef): Promise<string> {
    if (!this.config.ddlSql) {
      return `-- DDL unavailable for ${ref.schema ? `${ref.schema}.` : ""}${ref.name}`;
    }
    const result = await this.run(session, this.config.ddlSql, ...objectParams(ref, this.config.defaultSchema));
    const ddl = optionalString(result.rows[0] ?? {}, ["ddl", "statement", "create_table_query"]);
    return ddl ?? `-- DDL unavailable for ${ref.schema ? `${ref.schema}.` : ""}${ref.name}`;
  }

  async executeQuery(
    session: DbSession,
    sql: string,
    options?: QueryOptions
  ): Promise<QueryResult> {
    if (options?.signal?.aborted) {
      throw new Error("Query cancelled.");
    }
    const started = Date.now();
    const result = await this.run(session, sql, ...(options?.params ?? []));
    const rows = options?.maxRows === undefined ? result.rows : result.rows.slice(0, options.maxRows);
    return {
      queryId: newId(),
      columns: columnsFromResult(result, rows),
      rows,
      rowCount: rows.length,
      affectedRows: result.affectedRows,
      durationMs: Date.now() - started,
      truncated: options?.maxRows !== undefined && result.rows.length > options.maxRows
    };
  }

  private async listObjects(
    session: DbSession,
    sql: string | undefined,
    schema: string | undefined,
    type: TableInfo["type"]
  ): Promise<TableInfo[]> {
    if (!sql) {
      return [];
    }
    const schemaName = schema ?? this.config.defaultSchema;
    const result = await this.run(session, sql, ...(schemaName ? [schemaName] : []));
    return result.rows.map((row) => ({
      name: firstString(row, ["table_name", "name", "Table", "view_name"]),
      schema: schemaName,
      type,
      rowEstimate: optionalNumber(row, ["row_count", "rows"])
    }));
  }

  private async run(session: DbSession, sql: string, ...params: unknown[]): Promise<HttpSqlResult> {
    const profile = this.sessions.get(session.id);
    if (!profile) {
      throw new Error(`${this.config.label} session is not connected.`);
    }
    return this.executor.execute(profile, sql, params);
  }
}

export class CloudflareD1Adapter extends HttpSqlAdapter {
  constructor(executor?: HttpSqlExecutor) {
    super(
      {
        dbType: "cloudflare-d1",
        label: "Cloudflare D1",
        quote: "double",
        tablesSql: "SELECT name AS table_name FROM sqlite_master WHERE type = 'table' ORDER BY name",
        viewsSql: "SELECT name AS table_name FROM sqlite_master WHERE type = 'view' ORDER BY name",
        columnsSql: "PRAGMA table_info(?)",
        ddlSql: "SELECT sql AS ddl FROM sqlite_master WHERE name = ?"
      },
      executor
    );
  }
}

export class TursoAdapter extends HttpSqlAdapter {
  constructor(executor?: HttpSqlExecutor) {
    super(
      {
        dbType: "turso",
        label: "Turso",
        quote: "double",
        tablesSql: "SELECT name AS table_name FROM sqlite_master WHERE type = 'table' ORDER BY name",
        viewsSql: "SELECT name AS table_name FROM sqlite_master WHERE type = 'view' ORDER BY name",
        columnsSql: "PRAGMA table_info(?)",
        ddlSql: "SELECT sql AS ddl FROM sqlite_master WHERE name = ?"
      },
      executor
    );
  }
}

export class ClickHouseAdapter extends HttpSqlAdapter {
  constructor(executor?: HttpSqlExecutor) {
    super(
      {
        dbType: "clickhouse",
        label: "ClickHouse",
        quote: "double",
        defaultSchema: "default",
        schemasSql: "SELECT name AS schema_name FROM system.databases ORDER BY name",
        tablesSql:
          "SELECT name AS table_name, total_rows AS row_count FROM system.tables WHERE database = ? AND engine NOT LIKE '%View%' ORDER BY name",
        viewsSql:
          "SELECT name AS table_name FROM system.tables WHERE database = ? AND engine LIKE '%View%' ORDER BY name",
        columnsSql:
          "SELECT name AS column_name, type AS data_type, position AS ordinal_position FROM system.columns WHERE database = ? AND table = ? ORDER BY position",
        ddlSql:
          "SELECT create_table_query AS ddl FROM system.tables WHERE database = ? AND name = ?"
      },
      executor
    );
  }
}

export class TrinoAdapter extends HttpSqlAdapter {
  constructor(executor?: HttpSqlExecutor) {
    super(
      {
        dbType: "trino",
        label: "Trino",
        quote: "double",
        schemasSql: "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name",
        tablesSql:
          "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name",
        viewsSql:
          "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'VIEW' ORDER BY table_name",
        columnsSql:
          "SELECT column_name, data_type, ordinal_position FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position"
      },
      executor
    );
  }
}

export class PrestoAdapter extends HttpSqlAdapter {
  constructor(executor?: HttpSqlExecutor) {
    super(
      {
        dbType: "presto",
        label: "Presto",
        quote: "double",
        schemasSql: "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name",
        tablesSql:
          "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name",
        viewsSql:
          "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'VIEW' ORDER BY table_name",
        columnsSql:
          "SELECT column_name, data_type, ordinal_position FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position"
      },
      executor
    );
  }
}

function endpointFor(profile: RuntimeConnectionProfile): string {
  const host = profile.host?.trim();
  if (!host) {
    throw new Error(`${profile.dbType} HTTP endpoint is required.`);
  }
  return host.startsWith("http://") || host.startsWith("https://") ? host : `https://${host}`;
}

function headersFor(profile: RuntimeConnectionProfile): Record<string, string> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (profile.password) {
    headers.authorization = `Bearer ${profile.password}`;
  }
  if (profile.username) {
    headers["x-open-db-nexus-user"] = profile.username;
  }
  return headers;
}

function objectParams(ref: ObjectRef, defaultSchema: string | undefined): unknown[] {
  const schema = ref.schema ?? defaultSchema;
  return schema ? [schema, ref.name] : [ref.name];
}

function normalizeHttpSqlPayload(payload: unknown): HttpSqlResult {
  if (Array.isArray(payload)) {
    return { rows: payload.filter(isRow) };
  }
  if (!isRow(payload)) {
    return { rows: [] };
  }
  const rows = extractRows(payload);
  const columns = Array.isArray(payload.meta)
    ? payload.meta.filter(isRow).map((column) => firstString(column, ["name"]))
    : undefined;
  return {
    rows,
    columns,
    affectedRows: optionalNumber(payload, ["changes", "rowsAffected", "rows_affected"])
  };
}

function extractRows(payload: HttpRow): HttpRow[] {
  for (const key of ["rows", "data", "result", "results"]) {
    const value = payload[key];
    if (Array.isArray(value)) {
      if (value.every(isRow)) {
        return value;
      }
      const nested = value.flatMap((item) => (isRow(item) ? extractRows(item) : []));
      if (nested.length > 0) {
        return nested;
      }
    }
  }
  return [];
}

function columnsFromResult(result: HttpSqlResult, rows: HttpRow[]): QueryColumn[] {
  const names = result.columns ?? Object.keys(rows[0] ?? {});
  return names.map((name, ordinal) => ({ name, ordinal }));
}

function firstString(row: HttpRow, keys: string[]): string {
  return optionalString(row, keys) ?? "";
}

function optionalString(row: HttpRow, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
      return String(value);
    }
  }
  return undefined;
}

function firstNumber(row: HttpRow, keys: string[], fallback: number): number {
  return optionalNumber(row, keys) ?? fallback;
}

function optionalNumber(row: HttpRow, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function splitColumns(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value === "string") {
    return value.split(",").map((part) => part.trim()).filter(Boolean);
  }
  return [];
}

function isRow(value: unknown): value is HttpRow {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
