import sql from "mssql";
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
import { quoteBracket } from "../../utils/sqlSafety";
import type { PaginationStyle } from "../common/pagination";
import type { DatabaseAdapter, DbSession } from "../DatabaseAdapter";
import * as Q from "./sqlServerMetadataQueries";

const DEFAULT_SCHEMA = "dbo";

/** Kết quả query tối giản mà adapter cần. */
export interface MssqlQueryResult {
  rows: Record<string, unknown>[];
  columns: string[];
  rowsAffected: number;
}

/** Client tối giản (bọc mssql) — cho phép inject mock khi test. */
export interface MssqlClient {
  query(sql: string, params?: unknown[]): Promise<MssqlQueryResult>;
  end(): Promise<void>;
}

export interface MssqlConnectionConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}

export type MssqlClientFactory = (config: MssqlConnectionConfig) => Promise<MssqlClient>;

const defaultFactory: MssqlClientFactory = async (config) => {
  const pool = new sql.ConnectionPool({
    server: config.host ?? "localhost",
    port: config.port ?? 1433,
    user: config.user,
    password: config.password,
    database: config.database,
    // Trust server certificate cho SQL Server local/Docker (self-signed cert).
    options: { trustServerCertificate: true, encrypt: true }
  });
  await pool.connect();
  return {
    query: async (text, params) => {
      const request = pool.request();
      (params ?? []).forEach((value, index) => {
        // Bind theo @p1, @p2... khớp với placeholderStyle "named".
        request.input(`p${index + 1}`, value);
      });
      const result = await request.query(text);
      const recordset = result.recordset as
        | (Record<string, unknown>[] & { columns?: object })
        | undefined;
      const rows = recordset ?? [];
      const columns = recordset?.columns
        ? Object.keys(recordset.columns)
        : rows[0]
          ? Object.keys(rows[0])
          : [];
      const rowsAffected = (result.rowsAffected ?? []).reduce((sum, n) => sum + n, 0);
      return { rows, columns, rowsAffected };
    },
    end: () => pool.close()
  };
};

/** Adapter SQL Server (async) dùng mssql/tedious. */
export class SqlServerAdapter implements DatabaseAdapter {
  readonly dbType: DbType = "sqlserver";
  readonly paginationStyle: PaginationStyle = "offset-fetch";
  readonly placeholderStyle: PlaceholderStyle = "named";

  private readonly sessions = new Map<string, MssqlClient>();

  constructor(private readonly factory: MssqlClientFactory = defaultFactory) {}

  quoteIdentifier(name: string): string {
    return quoteBracket(name);
  }

  async connect(profile: RuntimeConnectionProfile): Promise<DbSession> {
    const client = await this.factory(toConfig(profile));
    const id = newId();
    this.sessions.set(id, client);
    return { id, dbType: this.dbType };
  }

  async testConnection(profile: RuntimeConnectionProfile): Promise<TestConnectionResult> {
    let client: MssqlClient | undefined;
    try {
      client = await this.factory(toConfig(profile));
      await client.query("SELECT 1 AS ok");
      return { ok: true, message: "Connected to SQL Server successfully." };
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
    return result.rows.map((row) => ({
      name: String(row.name),
      isDefault: row.name === DEFAULT_SCHEMA
    }));
  }

  async listTables(session: DbSession, schema = DEFAULT_SCHEMA): Promise<TableInfo[]> {
    const result = await this.client(session).query(Q.listTablesSql(schema));
    return result.rows.map((row) => ({ name: String(row.name), schema, type: "base_table" }));
  }

  async listViews(session: DbSession, schema = DEFAULT_SCHEMA): Promise<TableInfo[]> {
    const result = await this.client(session).query(Q.listViewsSql(schema));
    return result.rows.map((row) => ({ name: String(row.name), schema, type: "view" }));
  }

  async listColumns(session: DbSession, ref: ObjectRef): Promise<ColumnInfo[]> {
    const schema = ref.schema ?? DEFAULT_SCHEMA;
    const client = this.client(session);
    const [columns, pks] = await Promise.all([
      client.query(Q.listColumnsSql(schema, ref.name)),
      client.query(Q.listPrimaryKeysSql(schema, ref.name))
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
    const result = await this.client(session).query(Q.listIndexesSql(schema, ref.name));
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
    const result = await this.client(session).query(Q.listForeignKeysSql(schema, ref.name));
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
    const result = await this.client(session).query(Q.listTriggersSql(schema, ref.name));
    return result.rows.map((row) => ({
      name: String(row.trigger_name),
      timing: row.action_timing == null ? undefined : (row.action_timing as string),
      event: row.event_manipulation == null ? undefined : (row.event_manipulation as string),
      statement: row.action_statement == null ? undefined : (row.action_statement as string)
    }));
  }

  async listCheckConstraints(session: DbSession, ref: ObjectRef): Promise<CheckConstraintInfo[]> {
    const schema = ref.schema ?? DEFAULT_SCHEMA;
    const result = await this.client(session).query(Q.listChecksSql(schema, ref.name));
    return result.rows.map((row) => ({
      name: String(row.constraint_name),
      expression: String(row.check_clause)
    }));
  }

  async listViewDependencies(session: DbSession, ref: ObjectRef): Promise<ObjectRef[]> {
    const schema = ref.schema ?? DEFAULT_SCHEMA;
    const result = await this.client(session).query(Q.listViewDependenciesSql(schema, ref.name));
    return result.rows.map((row) => ({
      schema: String(row.table_schema),
      name: String(row.table_name)
    }));
  }

  async getObjectDDL(session: DbSession, ref: ObjectRef): Promise<string> {
    const schema = ref.schema ?? DEFAULT_SCHEMA;
    const def = await this.client(session).query(Q.objectDefinitionSql(schema, ref.name));
    const definition = def.rows[0]?.def as string | null | undefined;
    if (definition) {
      return definition;
    }
    const columns = await this.listColumns(session, ref);
    const lines = columns.map(
      (column) => `  ${column.name} ${column.dataType}${column.nullable ? "" : " NOT NULL"}`
    );
    return `CREATE TABLE ${quoteBracket(schema)}.${quoteBracket(ref.name)} (\n${lines.join(",\n")}\n);`;
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
    const columns: QueryColumn[] = result.columns.map((name, index) => ({ name, ordinal: index }));
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
      affectedRows: isSelect ? undefined : result.rowsAffected,
      durationMs: Date.now() - started,
      truncated
    };
  }

  private client(session: DbSession): MssqlClient {
    const client = this.sessions.get(session.id);
    if (!client) {
      throw new Error("SQL Server session is not connected.");
    }
    return client;
  }
}

function toConfig(profile: RuntimeConnectionProfile): MssqlConnectionConfig {
  return {
    host: profile.host,
    port: profile.port ?? 1433,
    user: profile.username,
    password: profile.password,
    database: profile.database
  };
}

async function safeEnd(client: MssqlClient): Promise<void> {
  try {
    await client.end();
  } catch {
    // bỏ qua lỗi khi đóng kết nối đã hỏng
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
