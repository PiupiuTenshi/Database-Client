import type { ConnectionProfile, ObjectRef, QueryResult } from "../core/types";
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
    return adapter.executeQuery(session, stmt.sql, { params: stmt.params });
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
    return adapter.executeQuery(session, stmt.sql, { params: stmt.params });
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
    return adapter.executeQuery(session, stmt.sql, { params: stmt.params });
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
    const { adapter } = await this.sessionManager.getOrConnect(profile);
    return buildDropColumn(ref, column, (id) => adapter.quoteIdentifier(id));
  }

  /** Thực thi một câu DDL đã được preview/duyệt. */
  async runDdl(profile: ConnectionProfile, sql: string): Promise<QueryResult> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    return adapter.executeQuery(session, sql);
  }
}
