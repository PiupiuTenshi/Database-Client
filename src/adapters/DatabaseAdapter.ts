import type {
  ColumnInfo,
  DbType,
  ForeignKeyInfo,
  IndexInfo,
  ObjectRef,
  QueryOptions,
  QueryResult,
  RuntimeConnectionProfile,
  SchemaInfo,
  TableInfo,
  TestConnectionResult
} from "../core/types";
import type { PaginationStyle } from "./common/pagination";

/**
 * Handle phiên kết nối. Adapter tự quản lý chi tiết driver bên trong; service
 * chỉ giữ handle opaque này.
 */
export interface DbSession {
  readonly id: string;
  readonly dbType: DbType;
}

/**
 * Hợp đồng chung cho mọi DBMS. Mỗi engine implement interface này và đăng ký
 * vào AdapterRegistry. Output luôn chuẩn hóa về type trong core/types.ts —
 * không để shape riêng của driver lọt ra ngoài.
 */
export interface DatabaseAdapter {
  readonly dbType: DbType;

  /** Kiểu phân trang cho table viewer (limit-offset / offset-fetch). */
  readonly paginationStyle: PaginationStyle;

  /** Bọc identifier theo dialect (double-quote / backtick / bracket) cho SQL extension tự sinh. */
  quoteIdentifier(name: string): string;

  connect(profile: RuntimeConnectionProfile): Promise<DbSession>;
  testConnection(profile: RuntimeConnectionProfile): Promise<TestConnectionResult>;
  disconnect(session: DbSession): Promise<void>;

  /** Danh sách schema. Trả [] nếu engine không có lớp schema (vd SQLite). */
  listSchemas(session: DbSession): Promise<SchemaInfo[]>;
  listTables(session: DbSession, schema?: string): Promise<TableInfo[]>;
  listViews(session: DbSession, schema?: string): Promise<TableInfo[]>;
  listColumns(session: DbSession, ref: ObjectRef): Promise<ColumnInfo[]>;
  listIndexes(session: DbSession, ref: ObjectRef): Promise<IndexInfo[]>;
  listForeignKeys(session: DbSession, ref: ObjectRef): Promise<ForeignKeyInfo[]>;
  getObjectDDL(session: DbSession, ref: ObjectRef): Promise<string>;

  executeQuery(session: DbSession, sql: string, options?: QueryOptions): Promise<QueryResult>;
}
