/**
 * Database engine được hỗ trợ qua adapter layer (xem docs/04). Phase 3 mới
 * implement adapter cho SQLite; các engine khác sẽ tới sau.
 */
export type DbType =
  | "sqlite"
  | "postgresql"
  | "mysql"
  | "mariadb"
  | "sqlserver"
  | "duckdb"
  | "mongodb"
  | "redis"
  | "oracle";

/** Môi trường của connection — dùng cho production guard (docs/07). */
export type ConnectionEnvironment = "local" | "dev" | "staging" | "production";

/**
 * Connection profile lưu trong globalState. CHỈ chứa metadata không nhạy cảm —
 * password KHÔNG bao giờ nằm ở đây mà ở SecretStorage (xem SecretStore).
 */
export interface ConnectionProfile {
  id: string;
  name: string;
  dbType: DbType;
  host?: string;
  port?: number;
  username?: string;
  database?: string;
  /** Dùng cho DB dạng file (sqlite, duckdb). */
  filePath?: string;
  environment: ConnectionEnvironment;
  tags: string[];
  color?: string;
  createdAt: string;
  updatedAt: string;
}

/** Profile + secret, chỉ tồn tại trong bộ nhớ runtime khi kết nối. */
export interface RuntimeConnectionProfile extends ConnectionProfile {
  password?: string;
}

/** Dữ liệu người dùng nhập ở form (chưa có id/timestamp). */
export interface ConnectionDraft {
  name: string;
  dbType: DbType;
  host?: string;
  port?: number;
  username?: string;
  database?: string;
  filePath?: string;
  environment: ConnectionEnvironment;
  tags: string[];
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Metadata models (chuẩn hóa từ mọi DBMS — docs/04 §7)
// ---------------------------------------------------------------------------

/** Tham chiếu một đối tượng schema (table/view). */
export interface ObjectRef {
  schema?: string;
  name: string;
}

export interface TableInfo {
  name: string;
  schema?: string;
  type: "base_table" | "view";
  rowEstimate?: number;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  ordinal: number;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
}

export interface IndexInfo {
  name: string;
  unique: boolean;
  columns: string[];
}

export interface ForeignKeyInfo {
  name: string;
  source: { schema?: string; table: string; columns: string[] };
  target: { schema?: string; table: string; columns: string[] };
  onUpdate?: string;
  onDelete?: string;
}

// ---------------------------------------------------------------------------
// Query models (docs/06)
// ---------------------------------------------------------------------------

export interface QueryColumn {
  name: string;
  dataType?: string;
  ordinal: number;
}

export type QueryRow = Record<string, unknown>;

export interface QueryResult {
  queryId: string;
  columns: QueryColumn[];
  rows: QueryRow[];
  rowCount: number;
  affectedRows?: number;
  durationMs: number;
  truncated?: boolean;
}

export interface QueryOptions {
  maxRows?: number;
}
