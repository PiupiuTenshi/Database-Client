/**
 * Driver identifiers cho các database engine sẽ hỗ trợ qua adapter layer.
 * Phase 1 chỉ dùng để gắn nhãn cho connection mock.
 */
export type DatabaseDriver = "sqlite" | "postgresql" | "mysql" | "sqlserver" | "mongodb" | "redis";

/**
 * Connection profile tối thiểu. Phase 1 lưu in-memory (mock).
 * Phase 2 sẽ mở rộng (host/port/user...) và lưu qua ProfileStore + SecretStore.
 */
export interface ConnectionProfile {
  id: string;
  name: string;
  driver: DatabaseDriver;
}
