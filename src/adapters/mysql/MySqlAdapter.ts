import { createConnection, type FieldPacket, type ResultSetHeader } from "mysql2/promise";
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
import { quoteBacktick } from "../../utils/sqlSafety";
import type { PaginationStyle } from "../common/pagination";
import type { DatabaseAdapter, DbSession } from "../DatabaseAdapter";
import * as Q from "./mysqlMetadataQueries";

/** Kết quả query tối giản mà adapter cần. */
export interface MySqlQueryResult {
  rows: Record<string, unknown>[];
  fields: { name: string }[];
  affectedRows?: number;
}

/** Client tối giản (bọc mysql2) — cho phép inject mock khi test. */
export interface MySqlClient {
  query(sql: string, values?: unknown[]): Promise<MySqlQueryResult>;
  end(): Promise<void>;
}

export interface MySqlConnectionConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  ssl?: { rejectUnauthorized: boolean };
}

export type MySqlClientFactory = (config: MySqlConnectionConfig) => Promise<MySqlClient>;

const defaultFactory: MySqlClientFactory = async (config) => {
  const conn = await createConnection(config);
  return {
    query: async (sql, values) => {
      const [result, fields] = await conn.query(sql, values);
      if (Array.isArray(result)) {
        return {
          rows: result as Record<string, unknown>[],
          fields: (fields ?? []).map((field: FieldPacket) => ({ name: field.name }))
        };
      }
      return { rows: [], fields: [], affectedRows: (result as ResultSetHeader).affectedRows };
    },
    end: async () => {
      await conn.end();
    }
  };
};

/** Adapter MySQL/MariaDB (async) dùng mysql2. */
export class MySqlAdapter implements DatabaseAdapter {
  readonly paginationStyle: PaginationStyle = "limit-offset";
  readonly placeholderStyle: PlaceholderStyle = "qmark";

  private readonly sessions = new Map<string, MySqlClient>();

  constructor(
    readonly dbType: DbType = "mysql",
    private readonly factory: MySqlClientFactory = defaultFactory
  ) {}

  quoteIdentifier(name: string): string {
    return quoteBacktick(name);
  }

  async connect(profile: RuntimeConnectionProfile): Promise<DbSession> {
    const client = await this.factory(toConfig(profile));
    const id = newId();
    this.sessions.set(id, client);
    return { id, dbType: this.dbType };
  }

  async testConnection(profile: RuntimeConnectionProfile): Promise<TestConnectionResult> {
    let client: MySqlClient | undefined;
    try {
      client = await this.factory(toConfig(profile));
      await client.query("SELECT 1");
      return { ok: true, message: "Connected to MySQL/MariaDB successfully." };
    } catch (error) {
      return { ok: false, message: toErrorMessage(error) };
    } finally {
      if (client) {
        await safeEnd(client);
      }
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
    return result.rows.map((row) => ({ name: String(row.schema_name) }));
  }

  async listTables(session: DbSession, schema?: string): Promise<TableInfo[]> {
    const target = this.requireSchema(schema);
    const result = await this.client(session).query(Q.LIST_TABLES, [target]);
    return result.rows.map((row) => ({
      name: String(row.table_name),
      schema: target,
      type: "base_table"
    }));
  }

  async listViews(session: DbSession, schema?: string): Promise<TableInfo[]> {
    const target = this.requireSchema(schema);
    const result = await this.client(session).query(Q.LIST_VIEWS, [target]);
    return result.rows.map((row) => ({
      name: String(row.table_name),
      schema: target,
      type: "view"
    }));
  }

  async listColumns(session: DbSession, ref: ObjectRef): Promise<ColumnInfo[]> {
    const result = await this.client(session).query(Q.LIST_COLUMNS, [
      this.requireSchema(ref.schema),
      ref.name
    ]);
    return result.rows.map((row) => ({
      name: String(row.column_name),
      dataType: String(row.data_type),
      ordinal: Number(row.ordinal_position),
      nullable: row.is_nullable === "YES",
      defaultValue: row.column_default == null ? undefined : (row.column_default as string),
      isPrimaryKey: row.column_key === "PRI"
    }));
  }

  async listIndexes(session: DbSession, ref: ObjectRef): Promise<IndexInfo[]> {
    const result = await this.client(session).query(Q.LIST_INDEXES, [
      this.requireSchema(ref.schema),
      ref.name
    ]);
    const byName = new Map<string, IndexInfo>();
    for (const row of result.rows) {
      const name = String(row.index_name);
      let index = byName.get(name);
      if (!index) {
        index = { name, unique: Number(row.non_unique) === 0, columns: [] };
        byName.set(name, index);
      }
      index.columns.push(String(row.column_name));
    }
    return [...byName.values()];
  }

  async listForeignKeys(session: DbSession, ref: ObjectRef): Promise<ForeignKeyInfo[]> {
    const schema = this.requireSchema(ref.schema);
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
    const result = await this.client(session).query(Q.LIST_TRIGGERS, [
      this.requireSchema(ref.schema),
      ref.name
    ]);
    return result.rows.map((row) => ({
      name: String(row.trigger_name),
      timing: row.action_timing == null ? undefined : (row.action_timing as string),
      event: row.event_manipulation == null ? undefined : (row.event_manipulation as string),
      statement: row.action_statement == null ? undefined : (row.action_statement as string)
    }));
  }

  async listCheckConstraints(session: DbSession, ref: ObjectRef): Promise<CheckConstraintInfo[]> {
    const result = await this.client(session).query(Q.LIST_CHECKS, [
      this.requireSchema(ref.schema),
      ref.name
    ]);
    return result.rows.map((row) => ({
      name: String(row.constraint_name),
      expression: String(row.check_clause)
    }));
  }

  async listViewDependencies(_session: DbSession, _ref: ObjectRef): Promise<ObjectRef[]> {
    // MySQL không có INFORMATION_SCHEMA.VIEW_TABLE_USAGE; bỏ qua ở MVP.
    return [];
  }

  async getObjectDDL(session: DbSession, ref: ObjectRef): Promise<string> {
    const qualified = `${quoteBacktick(this.requireSchema(ref.schema))}.${quoteBacktick(ref.name)}`;
    const result = await this.client(session).query(`SHOW CREATE TABLE ${qualified}`);
    const row = result.rows[0] ?? {};
    return (
      (row["Create Table"] as string | undefined) ??
      (row["Create View"] as string | undefined) ??
      ""
    );
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
    const result = await this.client(session).query(sql, options?.params);
    const columns: QueryColumn[] = result.fields.map((field, index) => ({
      name: field.name,
      ordinal: index
    }));
    let rows = result.rows;
    const truncated = options?.maxRows !== undefined && rows.length > options.maxRows;
    if (truncated) {
      rows = rows.slice(0, options.maxRows);
    }
    const isSelect = columns.length > 0;
    return {
      queryId: newId(),
      columns,
      rows,
      rowCount: rows.length,
      affectedRows: isSelect ? undefined : result.affectedRows,
      durationMs: Date.now() - started,
      truncated
    };
  }

  private requireSchema(schema?: string): string {
    if (!schema) {
      throw new Error("MySQL requires a schema/database name.");
    }
    return schema;
  }

  private client(session: DbSession): MySqlClient {
    const client = this.sessions.get(session.id);
    if (!client) {
      throw new Error("MySQL session is not connected.");
    }
    return client;
  }
}

function toConfig(profile: RuntimeConnectionProfile): MySqlConnectionConfig {
  return {
    host: profile.host,
    port: profile.port ?? 3306,
    user: profile.username,
    password: profile.password,
    database: profile.database,
    ssl: profile.ssl ? { rejectUnauthorized: false } : undefined
  };
}

async function safeEnd(client: MySqlClient): Promise<void> {
  try {
    await client.end();
  } catch {
    // bỏ qua lỗi khi đóng kết nối đã hỏng
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
