import { Client } from "pg";
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
import { qualify, quoteIdentifier } from "../../utils/sqlSafety";
import type { PaginationStyle } from "../common/pagination";
import type { DatabaseAdapter, DbSession } from "../DatabaseAdapter";
import * as Q from "./postgresMetadataQueries";

const DEFAULT_SCHEMA = "public";

/** Kết quả query tối giản mà adapter cần (tương thích pg.QueryResult). */
export interface PgQueryResult {
  rows: Record<string, unknown>[];
  fields: { name: string }[];
  rowCount: number | null;
  command: string;
}

/** Client tối giản (tương thích pg.Client) — cho phép inject mock khi test. */
export interface PgClient {
  connect(): Promise<void>;
  query(text: string, values?: unknown[]): Promise<PgQueryResult>;
  end(): Promise<void>;
}

export interface PgConnectionConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: { rejectUnauthorized: boolean };
}

export type PgClientFactory = (config: PgConnectionConfig) => PgClient;

const defaultFactory: PgClientFactory = (config) => new Client(config) as unknown as PgClient;

/** Adapter PostgreSQL (async) dùng node-postgres. */
export class PostgresAdapter implements DatabaseAdapter {
  readonly dbType: DbType = "postgresql";
  readonly paginationStyle: PaginationStyle = "limit-offset";
  readonly placeholderStyle: PlaceholderStyle = "numbered";

  private readonly sessions = new Map<string, PgClient>();

  constructor(private readonly factory: PgClientFactory = defaultFactory) {}

  quoteIdentifier(name: string): string {
    return quoteIdentifier(name);
  }

  async connect(profile: RuntimeConnectionProfile): Promise<DbSession> {
    const client = this.factory(toConfig(profile));
    await client.connect();
    const id = newId();
    this.sessions.set(id, client);
    return { id, dbType: this.dbType };
  }

  async testConnection(profile: RuntimeConnectionProfile): Promise<TestConnectionResult> {
    const client = this.factory(toConfig(profile));
    try {
      await client.connect();
      await client.query("SELECT 1");
      return { ok: true, message: "Connected to PostgreSQL successfully." };
    } catch (error) {
      return { ok: false, message: toErrorMessage(error) };
    } finally {
      await safeEnd(client);
    }
  }

  async disconnect(session: DbSession): Promise<void> {
    const client = this.sessions.get(session.id);
    if (client) {
      this.sessions.delete(session.id);
      await safeEnd(client);
    }
  }

  async listSchemas(session: DbSession): Promise<SchemaInfo[]> {
    const result = await this.client(session).query(Q.LIST_SCHEMAS);
    return result.rows.map((row) => ({
      name: String(row.schema_name),
      isDefault: row.schema_name === DEFAULT_SCHEMA
    }));
  }

  async listTables(session: DbSession, schema = DEFAULT_SCHEMA): Promise<TableInfo[]> {
    const result = await this.client(session).query(Q.LIST_TABLES, [schema]);
    return result.rows.map((row) => ({
      name: String(row.table_name),
      schema,
      type: "base_table"
    }));
  }

  async listViews(session: DbSession, schema = DEFAULT_SCHEMA): Promise<TableInfo[]> {
    const result = await this.client(session).query(Q.LIST_VIEWS, [schema]);
    return result.rows.map((row) => ({
      name: String(row.table_name),
      schema,
      type: "view"
    }));
  }

  async listColumns(session: DbSession, ref: ObjectRef): Promise<ColumnInfo[]> {
    const schema = ref.schema ?? DEFAULT_SCHEMA;
    const client = this.client(session);
    const [columns, pks] = await Promise.all([
      client.query(Q.LIST_COLUMNS, [schema, ref.name]),
      client.query(Q.LIST_PRIMARY_KEYS, [schema, ref.name])
    ]);
    const pkSet = new Set(pks.rows.map((row) => String(row.column_name)));
    return columns.rows.map((row) => ({
      name: String(row.column_name),
      dataType: String(row.data_type),
      ordinal: Number(row.ordinal_position),
      nullable: row.is_nullable === "YES",
      defaultValue: row.column_default == null ? undefined : (row.column_default as string),
      isPrimaryKey: pkSet.has(String(row.column_name))
    }));
  }

  async listIndexes(session: DbSession, ref: ObjectRef): Promise<IndexInfo[]> {
    const schema = ref.schema ?? DEFAULT_SCHEMA;
    const result = await this.client(session).query(Q.LIST_INDEXES, [schema, ref.name]);
    const byName = new Map<string, IndexInfo>();
    for (const row of result.rows) {
      const name = String(row.index_name);
      let index = byName.get(name);
      if (!index) {
        index = { name, unique: Boolean(row.is_unique), columns: [] };
        byName.set(name, index);
      }
      index.columns.push(String(row.column_name));
    }
    return [...byName.values()];
  }

  async listForeignKeys(session: DbSession, ref: ObjectRef): Promise<ForeignKeyInfo[]> {
    const schema = ref.schema ?? DEFAULT_SCHEMA;
    const result = await this.client(session).query(Q.LIST_FOREIGN_KEYS, [schema, ref.name]);
    const byName = new Map<string, ForeignKeyInfo>();
    for (const row of result.rows) {
      const name = String(row.constraint_name);
      let fk = byName.get(name);
      if (!fk) {
        fk = {
          name,
          source: { schema, table: ref.name, columns: [] },
          target: { table: String(row.target_table), columns: [] },
          onUpdate: row.update_rule == null ? undefined : (row.update_rule as string),
          onDelete: row.delete_rule == null ? undefined : (row.delete_rule as string)
        };
        byName.set(name, fk);
      }
      fk.source.columns.push(String(row.source_column));
      fk.target.columns.push(String(row.target_column));
    }
    return [...byName.values()];
  }

  async listTriggers(session: DbSession, ref: ObjectRef): Promise<TriggerInfo[]> {
    const schema = ref.schema ?? DEFAULT_SCHEMA;
    const result = await this.client(session).query(Q.LIST_TRIGGERS, [schema, ref.name]);
    const byName = new Map<string, TriggerInfo>();
    for (const row of result.rows) {
      const name = String(row.trigger_name);
      let trigger = byName.get(name);
      if (!trigger) {
        trigger = {
          name,
          timing: row.action_timing == null ? undefined : (row.action_timing as string),
          event: row.event_manipulation == null ? undefined : (row.event_manipulation as string),
          statement: row.action_statement == null ? undefined : (row.action_statement as string)
        };
        byName.set(name, trigger);
      } else if (row.event_manipulation) {
        trigger.event = `${trigger.event}, ${row.event_manipulation as string}`;
      }
    }
    return [...byName.values()];
  }

  async listCheckConstraints(session: DbSession, ref: ObjectRef): Promise<CheckConstraintInfo[]> {
    const schema = ref.schema ?? DEFAULT_SCHEMA;
    const result = await this.client(session).query(Q.LIST_CHECKS, [schema, ref.name]);
    return result.rows.map((row) => ({
      name: String(row.constraint_name),
      expression: String(row.check_clause)
    }));
  }

  async listViewDependencies(session: DbSession, ref: ObjectRef): Promise<ObjectRef[]> {
    const schema = ref.schema ?? DEFAULT_SCHEMA;
    const result = await this.client(session).query(Q.LIST_VIEW_DEPENDENCIES, [schema, ref.name]);
    return result.rows.map((row) => ({
      schema: String(row.table_schema),
      name: String(row.table_name)
    }));
  }

  async getObjectDDL(session: DbSession, ref: ObjectRef): Promise<string> {
    const schema = ref.schema ?? DEFAULT_SCHEMA;
    const client = this.client(session);
    const kind = await client.query(Q.REL_KIND, [schema, ref.name]);
    const relkind = kind.rows[0]?.relkind;
    if (relkind === "v" || relkind === "m") {
      const def = await client.query(Q.VIEW_DEF, [schema, ref.name]);
      return `CREATE VIEW ${qualify(schema, ref.name)} AS\n${(def.rows[0]?.def as string | undefined) ?? ""}`;
    }
    const columns = await this.listColumns(session, ref);
    const lines = columns.map((column) => {
      const nullable = column.nullable ? "" : " NOT NULL";
      return `  ${column.name} ${column.dataType}${nullable}`;
    });
    return `CREATE TABLE ${qualify(schema, ref.name)} (\n${lines.join(",\n")}\n);`;
  }

  async executeQuery(
    session: DbSession,
    sql: string,
    options?: QueryOptions
  ): Promise<QueryResult> {
    if (options?.signal?.aborted) {
      throw new Error("Query cancelled.");
    }
    const client = this.client(session);
    const started = Date.now();
    const result = await client.query(sql, options?.params);
    const columns: QueryColumn[] = result.fields.map((field, index) => ({
      name: field.name,
      ordinal: index
    }));
    let rows = result.rows;
    const truncated = options?.maxRows !== undefined && rows.length > options.maxRows;
    if (truncated) {
      rows = rows.slice(0, options.maxRows);
    }
    const isSelect = result.command === "SELECT" || columns.length > 0;
    return {
      queryId: newId(),
      columns,
      rows,
      rowCount: rows.length,
      affectedRows: isSelect ? undefined : (result.rowCount ?? undefined),
      durationMs: Date.now() - started,
      truncated
    };
  }

  private client(session: DbSession): PgClient {
    const client = this.sessions.get(session.id);
    if (!client) {
      throw new Error("PostgreSQL session is not connected.");
    }
    return client;
  }
}

function toConfig(profile: RuntimeConnectionProfile): PgConnectionConfig {
  return {
    host: profile.host,
    port: profile.port ?? 5432,
    user: profile.username,
    password: profile.password,
    database: profile.database ?? "postgres",
    ssl: profile.ssl ? { rejectUnauthorized: false } : undefined
  };
}

async function safeEnd(client: PgClient): Promise<void> {
  try {
    await client.end();
  } catch {
    // bỏ qua lỗi khi đóng kết nối đã hỏng
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
