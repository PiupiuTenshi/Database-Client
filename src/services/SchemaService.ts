import type {
  ColumnInfo,
  ConnectionProfile,
  ForeignKeyInfo,
  IndexInfo,
  ObjectRef,
  TableInfo
} from "../core/types";
import type { SessionManager } from "./SessionManager";

/**
 * Đọc metadata schema qua adapter. Phase 3 chưa cache; mỗi lần gọi đọc trực
 * tiếp từ DB (SchemaCacheStore sẽ thêm ở phase sau).
 */
export class SchemaService {
  constructor(private readonly sessionManager: SessionManager) {}

  async listTables(profile: ConnectionProfile): Promise<TableInfo[]> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    return adapter.listTables(session);
  }

  async listViews(profile: ConnectionProfile): Promise<TableInfo[]> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    return adapter.listViews(session);
  }

  async listColumns(profile: ConnectionProfile, ref: ObjectRef): Promise<ColumnInfo[]> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    return adapter.listColumns(session, ref);
  }

  async listIndexes(profile: ConnectionProfile, ref: ObjectRef): Promise<IndexInfo[]> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    return adapter.listIndexes(session, ref);
  }

  async listForeignKeys(profile: ConnectionProfile, ref: ObjectRef): Promise<ForeignKeyInfo[]> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    return adapter.listForeignKeys(session, ref);
  }
}
