import type { ConnectionProfile, DbType, ObjectRef, QueryResult } from "../core/types";
import {
  buildAddColumn,
  buildDeleteByKey,
  buildDropColumn,
  buildInsert,
  buildUpdateByKey,
  type ColumnDefinition,
  type ColumnValue
} from "../utils/rowMutation";
import type { SessionManager } from "./SessionManager";

/**
 * Thao tác ghi dữ liệu và DDL cột, dùng parameterized statement (giá trị luôn
 * bind qua placeholder của driver). Mỗi câu DML là một statement nguyên tử.
 *
 * Production guard (confirm) được xử lý ở tầng command/webview trước khi gọi
 * service này — service chỉ thực thi.
 */
export class DataEditService {
  constructor(private readonly sessionManager: SessionManager) {}

  async insertRow(
    profile: ConnectionProfile,
    ref: ObjectRef,
    values: ColumnValue[]
  ): Promise<QueryResult> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    const stmt = buildInsert(
      ref,
      values,
      (id) => adapter.quoteIdentifier(id),
      adapter.placeholderStyle
    );
    return withStatement(
      await adapter.executeQuery(session, stmt.sql, { params: stmt.params }),
      stmt.sql,
      stmt.params
    );
  }

  async updateRow(
    profile: ConnectionProfile,
    ref: ObjectRef,
    set: ColumnValue[],
    keys: ColumnValue[]
  ): Promise<QueryResult> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    const stmt = buildUpdateByKey(
      ref,
      set,
      keys,
      (id) => adapter.quoteIdentifier(id),
      adapter.placeholderStyle
    );
    return withStatement(
      await adapter.executeQuery(session, stmt.sql, { params: stmt.params }),
      stmt.sql,
      stmt.params
    );
  }

  async deleteRow(
    profile: ConnectionProfile,
    ref: ObjectRef,
    keys: ColumnValue[]
  ): Promise<QueryResult> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    const stmt = buildDeleteByKey(
      ref,
      keys,
      (id) => adapter.quoteIdentifier(id),
      adapter.placeholderStyle
    );
    return withStatement(
      await adapter.executeQuery(session, stmt.sql, { params: stmt.params }),
      stmt.sql,
      stmt.params
    );
  }

  /** Sinh câu ALTER TABLE ADD COLUMN cho preview (chưa thực thi). */
  async previewAddColumn(
    profile: ConnectionProfile,
    ref: ObjectRef,
    def: ColumnDefinition
  ): Promise<string> {
    const { adapter } = await this.sessionManager.getOrConnect(profile);
    const keyword = adapter.dbType === "sqlserver" ? "ADD" : "ADD COLUMN";
    return buildAddColumn(ref, def, (id) => adapter.quoteIdentifier(id), keyword);
  }

  /** Sinh câu ALTER TABLE DROP COLUMN cho preview (chưa thực thi). */
  async previewDropColumn(
    profile: ConnectionProfile,
    ref: ObjectRef,
    column: string
  ): Promise<string> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    if (!supportsDropColumn(adapter.dbType)) {
      throw new Error(`${adapter.dbType} does not support SQL column drops from this panel.`);
    }
    const [columns, indexes, foreignKeys] = await Promise.all([
      adapter.listColumns(session, ref).catch(() => []),
      adapter.listIndexes(session, ref).catch(() => []),
      adapter.listForeignKeys(session, ref).catch(() => [])
    ]);
    const meta = columns.find((item) => equalsName(item.name, column));
    if (meta?.isPrimaryKey) {
      throw new Error(
        `Cannot drop primary key column "${column}" from this panel. Drop or change the primary key constraint first.`
      );
    }
    const index = indexes.find((item) =>
      item.columns.some((indexColumn) => equalsName(indexColumn, column))
    );
    if (index) {
      throw new Error(
        `Cannot drop indexed column "${column}" while index "${index.name}" still uses it. Drop the index first.`
      );
    }
    const foreignKey = foreignKeys.find((item) =>
      item.source.columns.some((fkColumn) => equalsName(fkColumn, column))
    );
    if (foreignKey) {
      throw new Error(
        `Cannot drop foreign-key column "${column}" while constraint "${foreignKey.name}" still uses it. Drop the foreign key first.`
      );
    }
    return buildDropColumn(ref, column, (id) => adapter.quoteIdentifier(id));
  }

  /** Thực thi một câu DDL đã được preview/duyệt. */
  async runDdl(profile: ConnectionProfile, sql: string): Promise<QueryResult> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    return withStatement(await adapter.executeQuery(session, sql), sql);
  }
}

function withStatement(result: QueryResult, sql: string, params?: unknown[]): QueryResult {
  return { ...result, sql, params };
}

function supportsDropColumn(dbType: DbType): boolean {
  return dbType !== "mongodb" && dbType !== "redis";
}

function equalsName(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0;
}
