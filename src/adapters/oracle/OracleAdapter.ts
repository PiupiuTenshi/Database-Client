import oracledb from "oracledb";
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
import type { PaginationStyle } from "../common/pagination";
import type { DatabaseAdapter, DbSession } from "../DatabaseAdapter";

export interface OracleExecuteResult {
  rows?: Record<string, unknown>[];
  metaData?: { name: string; dbTypeName?: string }[];
  rowsAffected?: number;
}

export interface OracleConnectionLike {
  execute(sql: string, binds?: unknown[] | Record<string, unknown>, options?: object): Promise<OracleExecuteResult>;
  close(): Promise<void>;
}

export interface OracleConnectionConfig {
  user?: string;
  password?: string;
  connectString: string;
}

export type OracleConnectionFactory = (
  config: OracleConnectionConfig
) => Promise<OracleConnectionLike>;

const defaultFactory: OracleConnectionFactory = async (config) => await oracledb.getConnection(config);

export class OracleAdapter implements DatabaseAdapter {
  readonly dbType: DbType = "oracle";
  readonly paginationStyle: PaginationStyle = "offset-fetch";
  readonly placeholderStyle: PlaceholderStyle = "colon";

  private readonly sessions = new Map<string, OracleConnectionLike>();

  constructor(private readonly factory: OracleConnectionFactory = defaultFactory) {}

  quoteIdentifier(name: string): string {
    return `"${name.replace(/"/g, '""').toUpperCase()}"`;
  }

  async connect(profile: RuntimeConnectionProfile): Promise<DbSession> {
    const connection = await this.factory(toConfig(profile));
    const id = newId();
    this.sessions.set(id, connection);
    return { id, dbType: this.dbType };
  }

  async testConnection(profile: RuntimeConnectionProfile): Promise<TestConnectionResult> {
    let connection: OracleConnectionLike | undefined;
    try {
      connection = await this.factory(toConfig(profile));
      await connection.execute("SELECT 1 AS ok FROM dual", [], resultOptions());
      return { ok: true, message: "Connected to Oracle successfully." };
    } catch (error) {
      return { ok: false, message: toErrorMessage(error) };
    } finally {
      if (connection) {
        await safeClose(connection);
      }
    }
  }

  async disconnect(session: DbSession): Promise<void> {
    const connection = this.sessions.get(session.id);
    if (connection) {
      this.sessions.delete(session.id);
      await safeClose(connection);
    }
  }

  async listSchemas(session: DbSession): Promise<SchemaInfo[]> {
    const result = await this.connection(session).execute(
      "SELECT username AS name FROM all_users ORDER BY username",
      [],
      resultOptions()
    );
    return rows(result).map((row) => ({ name: String(row.NAME ?? row.name) }));
  }

  async listTables(session: DbSession, schema?: string): Promise<TableInfo[]> {
    const owner = schema?.toUpperCase();
    const result = await this.connection(session).execute(
      `SELECT owner, table_name
       FROM all_tables
       WHERE (:p1 IS NULL OR owner = :p1)
       ORDER BY owner, table_name`,
      [owner ?? null],
      resultOptions()
    );
    return rows(result).map((row) => ({
      schema: String(row.OWNER ?? row.owner),
      name: String(row.TABLE_NAME ?? row.table_name),
      type: "base_table"
    }));
  }

  async listViews(session: DbSession, schema?: string): Promise<TableInfo[]> {
    const owner = schema?.toUpperCase();
    const result = await this.connection(session).execute(
      `SELECT owner, view_name
       FROM all_views
       WHERE (:p1 IS NULL OR owner = :p1)
       ORDER BY owner, view_name`,
      [owner ?? null],
      resultOptions()
    );
    return rows(result).map((row) => ({
      schema: String(row.OWNER ?? row.owner),
      name: String(row.VIEW_NAME ?? row.view_name),
      type: "view"
    }));
  }

  async listColumns(session: DbSession, ref: ObjectRef): Promise<ColumnInfo[]> {
    const owner = ownerFor(ref);
    const [columns, pks] = await Promise.all([
      this.connection(session).execute(
        `SELECT column_name, data_type, column_id, nullable, data_default
         FROM all_tab_columns
         WHERE owner = :p1 AND table_name = :p2
         ORDER BY column_id`,
        [owner, ref.name.toUpperCase()],
        resultOptions()
      ),
      this.primaryKeySet(session, ref)
    ]);
    return rows(columns).map((row) => ({
      name: String(row.COLUMN_NAME ?? row.column_name),
      dataType: String(row.DATA_TYPE ?? row.data_type),
      ordinal: Number(row.COLUMN_ID ?? row.column_id ?? 0),
      nullable: (row.NULLABLE ?? row.nullable) !== "N",
      defaultValue:
        row.DATA_DEFAULT == null && row.data_default == null
          ? undefined
          : String(row.DATA_DEFAULT ?? row.data_default).trim(),
      isPrimaryKey: pks.has(String(row.COLUMN_NAME ?? row.column_name))
    }));
  }

  async listIndexes(session: DbSession, ref: ObjectRef): Promise<IndexInfo[]> {
    const owner = ownerFor(ref);
    const result = await this.connection(session).execute(
      `SELECT i.index_name, i.uniqueness, c.column_name, c.column_position
       FROM all_indexes i
       JOIN all_ind_columns c ON c.index_owner = i.owner AND c.index_name = i.index_name
       WHERE i.owner = :p1 AND i.table_name = :p2
       ORDER BY i.index_name, c.column_position`,
      [owner, ref.name.toUpperCase()],
      resultOptions()
    );
    const byName = new Map<string, IndexInfo>();
    for (const row of rows(result)) {
      const name = String(row.INDEX_NAME ?? row.index_name);
      let index = byName.get(name);
      if (!index) {
        index = {
          name,
          unique: String(row.UNIQUENESS ?? row.uniqueness) === "UNIQUE",
          columns: []
        };
        byName.set(name, index);
      }
      index.columns.push(String(row.COLUMN_NAME ?? row.column_name));
    }
    return [...byName.values()];
  }

  async listForeignKeys(session: DbSession, ref: ObjectRef): Promise<ForeignKeyInfo[]> {
    const owner = ownerFor(ref);
    const result = await this.connection(session).execute(
      `SELECT ac.constraint_name, acc.column_name, r.owner AS r_owner, r.table_name AS r_table_name,
              rcc.column_name AS r_column_name, ac.delete_rule
       FROM all_constraints ac
       JOIN all_cons_columns acc ON acc.owner = ac.owner AND acc.constraint_name = ac.constraint_name
       JOIN all_constraints r ON r.owner = ac.r_owner AND r.constraint_name = ac.r_constraint_name
       JOIN all_cons_columns rcc ON rcc.owner = r.owner AND rcc.constraint_name = r.constraint_name AND rcc.position = acc.position
       WHERE ac.constraint_type = 'R' AND ac.owner = :p1 AND ac.table_name = :p2
       ORDER BY ac.constraint_name, acc.position`,
      [owner, ref.name.toUpperCase()],
      resultOptions()
    );
    const byName = new Map<string, ForeignKeyInfo>();
    for (const row of rows(result)) {
      const name = String(row.CONSTRAINT_NAME ?? row.constraint_name);
      let fk = byName.get(name);
      if (!fk) {
        fk = {
          name,
          source: { schema: owner, table: ref.name, columns: [] },
          target: {
            schema: String(row.R_OWNER ?? row.r_owner),
            table: String(row.R_TABLE_NAME ?? row.r_table_name),
            columns: []
          },
          onDelete: valueString(row.DELETE_RULE ?? row.delete_rule)
        };
        byName.set(name, fk);
      }
      fk.source.columns.push(String(row.COLUMN_NAME ?? row.column_name));
      fk.target.columns.push(String(row.R_COLUMN_NAME ?? row.r_column_name));
    }
    return [...byName.values()];
  }

  async listTriggers(session: DbSession, ref: ObjectRef): Promise<TriggerInfo[]> {
    const owner = ownerFor(ref);
    const result = await this.connection(session).execute(
      `SELECT trigger_name, triggering_event, trigger_type, trigger_body
       FROM all_triggers
       WHERE owner = :p1 AND table_name = :p2
       ORDER BY trigger_name`,
      [owner, ref.name.toUpperCase()],
      resultOptions()
    );
    return rows(result).map((row) => ({
      name: String(row.TRIGGER_NAME ?? row.trigger_name),
      event: valueString(row.TRIGGERING_EVENT ?? row.triggering_event),
      timing: valueString(row.TRIGGER_TYPE ?? row.trigger_type),
      statement: valueString(row.TRIGGER_BODY ?? row.trigger_body)
    }));
  }

  async listCheckConstraints(session: DbSession, ref: ObjectRef): Promise<CheckConstraintInfo[]> {
    const owner = ownerFor(ref);
    const result = await this.connection(session).execute(
      `SELECT constraint_name, search_condition
       FROM all_constraints
       WHERE constraint_type = 'C' AND owner = :p1 AND table_name = :p2
       ORDER BY constraint_name`,
      [owner, ref.name.toUpperCase()],
      resultOptions()
    );
    return rows(result).map((row) => ({
      name: String(row.CONSTRAINT_NAME ?? row.constraint_name),
      expression: valueString(row.SEARCH_CONDITION ?? row.search_condition) ?? ""
    }));
  }

  async listViewDependencies(session: DbSession, ref: ObjectRef): Promise<ObjectRef[]> {
    const owner = ownerFor(ref);
    const result = await this.connection(session).execute(
      `SELECT referenced_owner, referenced_name
       FROM all_dependencies
       WHERE owner = :p1 AND name = :p2 AND referenced_type IN ('TABLE', 'VIEW')`,
      [owner, ref.name.toUpperCase()],
      resultOptions()
    );
    return rows(result).map((row) => ({
      schema: String(row.REFERENCED_OWNER ?? row.referenced_owner),
      name: String(row.REFERENCED_NAME ?? row.referenced_name)
    }));
  }

  async getObjectDDL(session: DbSession, ref: ObjectRef): Promise<string> {
    const owner = ownerFor(ref);
    const result = await this.connection(session).execute(
      `SELECT DBMS_METADATA.GET_DDL('TABLE', :p1, :p2) AS ddl FROM dual`,
      [ref.name.toUpperCase(), owner],
      resultOptions()
    );
    const ddl = rows(result)[0]?.DDL ?? rows(result)[0]?.ddl;
    return typeof ddl === "string" ? ddl : `-- DDL unavailable for ${owner}.${ref.name}`;
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
    const result = await this.connection(session).execute(sql, toOracleBinds(options?.params), {
      ...resultOptions(),
      maxRows: options?.maxRows
    });
    const resultRows = rows(result);
    return {
      queryId: newId(),
      columns: columns(result),
      rows: resultRows,
      rowCount: resultRows.length,
      affectedRows: result.rowsAffected,
      durationMs: Date.now() - started,
      truncated: options?.maxRows !== undefined && resultRows.length >= options.maxRows
    };
  }

  private async primaryKeySet(session: DbSession, ref: ObjectRef): Promise<Set<string>> {
    const owner = ownerFor(ref);
    const result = await this.connection(session).execute(
      `SELECT acc.column_name
       FROM all_constraints ac
       JOIN all_cons_columns acc ON acc.owner = ac.owner AND acc.constraint_name = ac.constraint_name
       WHERE ac.constraint_type = 'P' AND ac.owner = :p1 AND ac.table_name = :p2`,
      [owner, ref.name.toUpperCase()],
      resultOptions()
    );
    return new Set(rows(result).map((row) => String(row.COLUMN_NAME ?? row.column_name)));
  }

  private connection(session: DbSession): OracleConnectionLike {
    const connection = this.sessions.get(session.id);
    if (!connection) {
      throw new Error("Oracle session is not connected.");
    }
    return connection;
  }
}

function toConfig(profile: RuntimeConnectionProfile): OracleConnectionConfig {
  const connectString = profile.database?.trim() || `${profile.host ?? "localhost"}:${profile.port ?? 1521}/XE`;
  return {
    user: profile.username,
    password: profile.password,
    connectString
  };
}

function resultOptions(): object {
  return { outFormat: oracledb.OUT_FORMAT_OBJECT };
}

function toOracleBinds(params: unknown[] | undefined): Record<string, unknown> {
  const binds: Record<string, unknown> = {};
  for (const [index, value] of (params ?? []).entries()) {
    binds[`p${index + 1}`] = value;
  }
  return binds;
}

function ownerFor(ref: ObjectRef): string {
  return (ref.schema ?? "").toUpperCase();
}

function rows(result: OracleExecuteResult): Record<string, unknown>[] {
  return result.rows ?? [];
}

function columns(result: OracleExecuteResult): QueryColumn[] {
  return (result.metaData ?? []).map((column, ordinal) => ({
    name: column.name,
    dataType: column.dbTypeName,
    ordinal
  }));
}

async function safeClose(connection: OracleConnectionLike): Promise<void> {
  try {
    await connection.close();
  } catch {
    // ignore close errors
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function valueString(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return undefined;
}
