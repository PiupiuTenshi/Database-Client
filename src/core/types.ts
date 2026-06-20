/**
 * Database engine được hỗ trợ qua adapter layer (xem docs/04). Phase 2 mới chỉ
 * lưu/sửa profile; kết nối thật đến từ adapter ở các phase sau.
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
