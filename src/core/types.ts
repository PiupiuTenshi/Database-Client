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

/** Một schema/namespace trong DB (Postgres, SQL Server...). */
export interface SchemaInfo {
  name: string;
  isDefault?: boolean;
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

/** Trigger gắn trên một table (Properties tab). `statement` có thể rỗng nếu engine không trả body. */
export interface TriggerInfo {
  name: string;
  /** BEFORE / AFTER / INSTEAD OF khi engine cung cấp. */
  timing?: string;
  /** INSERT / UPDATE / DELETE (hoặc danh sách gộp). */
  event?: string;
  statement?: string;
}

/** CHECK constraint trên table (Properties tab). */
export interface CheckConstraintInfo {
  name: string;
  expression: string;
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
  signal?: AbortSignal;
  /**
   * Giá trị bind cho query có placeholder (chống SQL injection). Thứ tự khớp với
   * placeholder theo `DatabaseAdapter.placeholderStyle`. Dùng cho data edit/DDL.
   */
  params?: unknown[];
}

/** Kiểu placeholder cho parameterized query theo dialect. */
export type PlaceholderStyle = "qmark" | "numbered" | "named";

/** Một câu SQL kèm tham số đã bind (cho data edit / DDL). */
export interface ParamStatement {
  sql: string;
  params: unknown[];
}

/** Lỗi DB đã chuẩn hóa (docs/04 §10). Không lộ stack dài cho user. */
export interface DbError {
  message: string;
  code?: string;
  detail?: string;
}

export type QueryStatus = "success" | "error" | "cancelled";

// ---------------------------------------------------------------------------
// Dependency graph (docs/05)
// ---------------------------------------------------------------------------

export type GraphDirection = "inbound" | "outbound" | "both";
export type GraphDepth = 1 | 2 | 3 | "all";

export interface GraphNode {
  id: string;
  label: string;
  type: "table" | "view";
  schema?: string;
  objectName: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "foreign_key" | "view_reference";
  label?: string;
  sourceColumns?: string[];
  targetColumns?: string[];
}

/** Một view và các đối tượng nó tham chiếu (cho view dependency). */
export interface ViewDependency {
  view: ObjectRef;
  references: ObjectRef[];
}

/** "source depends on target" (docs/05 §4). FK: child -> parent. */
export interface DependencyGraph {
  center?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  warnings?: string[];
}

/** Một dòng lịch sử query (docs/06 §11). */
export interface QueryHistoryItem {
  id: string;
  connectionId: string;
  connectionName: string;
  sql: string;
  status: QueryStatus;
  durationMs?: number;
  rowCount?: number;
  errorMessage?: string;
  createdAt: string;
}
