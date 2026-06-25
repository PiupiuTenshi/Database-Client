import { DuckDBInstance, type DuckDBValue } from "@duckdb/node-api";
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

type DuckRow = Record<string, unknown>;

export interface DuckDbConnection {
  runAndReadAll(sql: string, values?: DuckDBValue[]): Promise<DuckDbResultReader>;
  closeSync(): void;
}

export interface DuckDbResultReader {
  columnNames(): string[];
  getRowObjectsJS(): DuckRow[];
}

export interface DuckDbDatabase {
  connect(): Promise<DuckDbConnection>;
  closeSync(): void;
}

export type DuckDbFactory = (path: string, options: Record<string, string>) => Promise<DuckDbDatabase>;

const defaultFactory: DuckDbFactory = async (path, options) =>
  await DuckDBInstance.create(path, options);

export class DuckDbAdapter implements DatabaseAdapter {
  readonly dbType: DbType = "duckdb";
  readonly paginationStyle: PaginationStyle = "limit-offset";
  readonly placeholderStyle: PlaceholderStyle = "qmark";

  private readonly sessions = new Map<string, { db: DuckDbDatabase; connection: DuckDbConnection }>();

  constructor(private readonly factory: DuckDbFactory = defaultFactory) {}

  quoteIdentifier(name: string): string {
    return quoteIdentifier(name);
  }

  async connect(profile: RuntimeConnectionProfile): Promise<DbSession> {
    const db = await this.open(profile);
    const connection = await db.connect();
    await all(connection, "SELECT 1 AS ok");
    const id = newId();
    this.sessions.set(id, { db, connection });
    return { id, dbType: this.dbType };
  }

  async testConnection(profile: RuntimeConnectionProfile): Promise<TestConnectionResult> {
    let db: DuckDbDatabase | undefined;
    try {
      db = await this.open(profile);
      const connection = await db.connect();
      await all(connection, "SELECT 1 AS ok");
      closeConnection(connection);
      return { ok: true, message: "Connected to DuckDB successfully." };
    } catch (error) {
      return { ok: false, message: toErrorMessage(error) };
    } finally {
      if (db) {
        closeDatabase(db);
      }
    }
  }

  async disconnect(session: DbSession): Promise<void> {
    const entry = this.sessions.get(session.id);
    if (!entry) {
      return;
    }
    this.sessions.delete(session.id);
    closeConnection(entry.connection);
    closeDatabase(entry.db);
  }

  async listSchemas(session: DbSession): Promise<SchemaInfo[]> {
    const rows = await all(
      this.connection(session),
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' ORDER BY schema_name"
    );
    return rows.map((row) => ({
      name: String(row.schema_name),
      isDefault: row.schema_name === "main"
    }));
  }

  async listTables(session: DbSession, schema = "main"): Promise<TableInfo[]> {
    const rows = await all(
      this.connection(session),
      "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name",
      schema
    );
    return rows.map((row) => ({ name: String(row.table_name), schema, type: "base_table" }));
  }

  async listViews(session: DbSession, schema = "main"): Promise<TableInfo[]> {
    const rows = await all(
      this.connection(session),
      "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'VIEW' ORDER BY table_name",
      schema
    );
    return rows.map((row) => ({ name: String(row.table_name), schema, type: "view" }));
  }

  async listColumns(session: DbSession, ref: ObjectRef): Promise<ColumnInfo[]> {
    const schema = ref.schema ?? "main";
    const rows = await all(
      this.connection(session),
      `SELECT column_name, data_type, ordinal_position, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = ?
       ORDER BY ordinal_position`,
      schema,
      ref.name
    );
    const pkSet = await this.primaryKeySet(session, ref);
    return rows.map((row) => ({
      name: String(row.column_name),
      dataType: toScalarString(row.data_type),
      ordinal: Number(row.ordinal_position ?? 0),
      nullable: row.is_nullable !== "NO",
      defaultValue: row.column_default == null ? undefined : toScalarString(row.column_default),
      isPrimaryKey: pkSet.has(String(row.column_name))
    }));
  }

  async listIndexes(session: DbSession, ref: ObjectRef): Promise<IndexInfo[]> {
    const schema = ref.schema ?? "main";
    const rows = await all(
      this.connection(session),
      "SELECT index_name, is_unique, expressions FROM duckdb_indexes() WHERE schema_name = ? AND table_name = ? ORDER BY index_name",
      schema,
      ref.name
    ).catch(() => []);
    return rows.map((row) => ({
      name: String(row.index_name),
      unique: Boolean(row.is_unique),
      columns: splitDuckExpressionList(row.expressions)
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
    const schema = ref.schema ?? "main";
    const rows = await all(
      this.connection(session),
      "SELECT sql FROM duckdb_tables() WHERE schema_name = ? AND table_name = ?",
      schema,
      ref.name
    ).catch(() => []);
    const sql = rows[0]?.sql;
    if (typeof sql === "string" && sql.trim()) {
      return sql;
    }
    const columns = await this.listColumns(session, ref);
    return `CREATE TABLE ${this.qualify(ref)} (\n${columns
      .map((column) => `  ${this.quoteIdentifier(column.name)} ${column.dataType}`)
      .join(",\n")}\n);`;
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
    const rows = await all(this.connection(session), sql, ...(options?.params ?? []));
    const columns = columnsFromRows(rows);
    const truncated = options?.maxRows !== undefined && rows.length > options.maxRows;
    const limited = truncated ? rows.slice(0, options.maxRows) : rows;
    return {
      queryId: newId(),
      columns,
      rows: limited,
      rowCount: limited.length,
      durationMs: Date.now() - started,
      truncated
    };
  }

  private async primaryKeySet(session: DbSession, ref: ObjectRef): Promise<Set<string>> {
    const schema = ref.schema ?? "main";
    const rows = await all(
      this.connection(session),
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_schema = ?
         AND tc.table_name = ?`,
      schema,
      ref.name
    ).catch(() => []);
    return new Set(rows.map((row) => String(row.column_name)));
  }

  private async open(profile: RuntimeConnectionProfile): Promise<DuckDbDatabase> {
    const path = profile.filePath?.trim();
    if (!path) {
      throw new Error("DuckDB connection requires a file path.");
    }
    const readonly = profile.tags.some((tag) => tag.toLowerCase() === "readonly");
    const options: Record<string, string> = readonly ? { access_mode: "READ_ONLY" } : {};
    return await this.factory(path, options);
  }

  private connection(session: DbSession): DuckDbConnection {
    const entry = this.sessions.get(session.id);
    if (!entry) {
      throw new Error("DuckDB session is not connected.");
    }
    return entry.connection;
  }

  private qualify(ref: ObjectRef): string {
    return ref.schema
      ? `${this.quoteIdentifier(ref.schema)}.${this.quoteIdentifier(ref.name)}`
      : this.quoteIdentifier(ref.name);
  }
}

async function all(connection: DuckDbConnection, sql: string, ...params: unknown[]): Promise<DuckRow[]> {
  const reader = await connection.runAndReadAll(sql, params as DuckDBValue[]);
  return reader.getRowObjectsJS();
}

function closeConnection(connection: DuckDbConnection): void {
  connection.closeSync();
}

function closeDatabase(db: DuckDbDatabase): void {
  db.closeSync();
}

function columnsFromRows(rows: DuckRow[]): QueryColumn[] {
  const first = rows[0];
  if (!first) {
    return [];
  }
  return Object.keys(first).map((name, ordinal) => ({ name, ordinal }));
}

function splitDuckExpressionList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value !== "string") {
    return [];
  }
  return value
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toScalarString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return "";
}
