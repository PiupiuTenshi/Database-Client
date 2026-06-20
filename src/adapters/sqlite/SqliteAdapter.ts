import Database from "better-sqlite3";
import type {
  ColumnInfo,
  DbType,
  ForeignKeyInfo,
  IndexInfo,
  ObjectRef,
  QueryColumn,
  QueryOptions,
  QueryResult,
  RuntimeConnectionProfile,
  TableInfo,
  TestConnectionResult
} from "../../core/types";
import { newId } from "../../utils/objectId";
import { quoteStringLiteral } from "../../utils/sqlSafety";
import type { DatabaseAdapter, DbSession } from "../DatabaseAdapter";

type Db = Database.Database;

interface PragmaTableInfoRow {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

interface PragmaIndexListRow {
  seq: number;
  name: string;
  unique: number;
}

interface PragmaIndexInfoRow {
  seqno: number;
  cid: number;
  name: string;
}

interface PragmaForeignKeyRow {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
}

/** Adapter SQLite dựa trên better-sqlite3 (đồng bộ). */
export class SqliteAdapter implements DatabaseAdapter {
  readonly dbType: DbType = "sqlite";

  private readonly sessions = new Map<string, Db>();

  async connect(profile: RuntimeConnectionProfile): Promise<DbSession> {
    const db = this.open(profile);
    const id = newId();
    this.sessions.set(id, db);
    return { id, dbType: this.dbType };
  }

  async testConnection(profile: RuntimeConnectionProfile): Promise<TestConnectionResult> {
    try {
      const db = this.open(profile);
      try {
        db.prepare("SELECT 1").get();
      } finally {
        db.close();
      }
      return { ok: true, message: "Connected to SQLite successfully." };
    } catch (error) {
      return { ok: false, message: toErrorMessage(error) };
    }
  }

  async disconnect(session: DbSession): Promise<void> {
    const db = this.sessions.get(session.id);
    if (db) {
      db.close();
      this.sessions.delete(session.id);
    }
  }

  async listTables(session: DbSession): Promise<TableInfo[]> {
    return this.listObjects(session, "table");
  }

  async listViews(session: DbSession): Promise<TableInfo[]> {
    return this.listObjects(session, "view");
  }

  async listColumns(session: DbSession, ref: ObjectRef): Promise<ColumnInfo[]> {
    const db = this.getDb(session);
    const rows = db
      .prepare(`PRAGMA table_info(${quoteStringLiteral(ref.name)})`)
      .all() as PragmaTableInfoRow[];
    return rows.map((row) => ({
      name: row.name,
      dataType: row.type || "",
      ordinal: row.cid,
      nullable: row.notnull === 0,
      defaultValue: row.dflt_value ?? undefined,
      isPrimaryKey: row.pk > 0
    }));
  }

  async listIndexes(session: DbSession, ref: ObjectRef): Promise<IndexInfo[]> {
    const db = this.getDb(session);
    const indexes = db
      .prepare(`PRAGMA index_list(${quoteStringLiteral(ref.name)})`)
      .all() as PragmaIndexListRow[];
    return indexes.map((index) => {
      const columns = db
        .prepare(`PRAGMA index_info(${quoteStringLiteral(index.name)})`)
        .all() as PragmaIndexInfoRow[];
      return {
        name: index.name,
        unique: index.unique === 1,
        columns: columns.map((column) => column.name)
      };
    });
  }

  async listForeignKeys(session: DbSession, ref: ObjectRef): Promise<ForeignKeyInfo[]> {
    const db = this.getDb(session);
    const rows = db
      .prepare(`PRAGMA foreign_key_list(${quoteStringLiteral(ref.name)})`)
      .all() as PragmaForeignKeyRow[];

    const byId = new Map<number, ForeignKeyInfo>();
    for (const row of rows) {
      let fk = byId.get(row.id);
      if (!fk) {
        fk = {
          name: `fk_${ref.name}_${row.id}`,
          source: { table: ref.name, columns: [] },
          target: { table: row.table, columns: [] },
          onUpdate: row.on_update,
          onDelete: row.on_delete
        };
        byId.set(row.id, fk);
      }
      fk.source.columns.push(row.from);
      fk.target.columns.push(row.to);
    }
    return [...byId.values()];
  }

  async getObjectDDL(session: DbSession, ref: ObjectRef): Promise<string> {
    const db = this.getDb(session);
    const row = db.prepare("SELECT sql FROM sqlite_master WHERE name = ?").get(ref.name) as
      | { sql: string | null }
      | undefined;
    return row?.sql ?? "";
  }

  async executeQuery(
    session: DbSession,
    sql: string,
    options?: QueryOptions
  ): Promise<QueryResult> {
    const db = this.getDb(session);
    const started = Date.now();
    const statement = db.prepare(sql);

    if (statement.reader) {
      const columns: QueryColumn[] = statement.columns().map((column, index) => ({
        name: column.name,
        dataType: column.type ?? undefined,
        ordinal: index
      }));
      let rows = statement.all() as Record<string, unknown>[];
      const total = rows.length;
      const maxRows = options?.maxRows;
      const truncated = maxRows !== undefined && total > maxRows;
      if (truncated) {
        rows = rows.slice(0, maxRows);
      }
      return {
        queryId: newId(),
        columns,
        rows,
        rowCount: rows.length,
        durationMs: Date.now() - started,
        truncated
      };
    }

    const info = statement.run();
    return {
      queryId: newId(),
      columns: [],
      rows: [],
      rowCount: 0,
      affectedRows: info.changes,
      durationMs: Date.now() - started
    };
  }

  private listObjects(session: DbSession, type: "table" | "view"): TableInfo[] {
    const db = this.getDb(session);
    const rows = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all(type) as { name: string }[];
    return rows.map((row) => ({
      name: row.name,
      type: type === "table" ? "base_table" : "view"
    }));
  }

  private open(profile: RuntimeConnectionProfile): Db {
    const filePath = profile.filePath?.trim();
    if (!filePath) {
      throw new Error("SQLite connection requires a file path.");
    }
    const isMemory = filePath === ":memory:";
    return new Database(filePath, { fileMustExist: !isMemory });
  }

  private getDb(session: DbSession): Db {
    const db = this.sessions.get(session.id);
    if (!db) {
      throw new Error("SQLite session is not connected.");
    }
    return db;
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
