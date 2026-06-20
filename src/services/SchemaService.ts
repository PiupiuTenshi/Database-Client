import type {
  CheckConstraintInfo,
  ColumnInfo,
  ConnectionProfile,
  ForeignKeyInfo,
  IndexInfo,
  ObjectRef,
  SchemaInfo,
  TableInfo,
  TriggerInfo
} from "../core/types";
import type { SessionManager } from "./SessionManager";

/**
 * Đọc metadata schema qua adapter. Phase 5 chưa cache; mỗi lần gọi đọc trực
 * tiếp từ DB (SchemaCacheStore sẽ thêm ở phase sau).
 */
export class SchemaService {
  constructor(private readonly sessionManager: SessionManager) {}

  async listSchemas(profile: ConnectionProfile): Promise<SchemaInfo[]> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    return adapter.listSchemas(session);
  }

  async listTables(profile: ConnectionProfile, schema?: string): Promise<TableInfo[]> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    return adapter.listTables(session, schema);
  }

  async listViews(profile: ConnectionProfile, schema?: string): Promise<TableInfo[]> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    return adapter.listViews(session, schema);
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

  async listTriggers(profile: ConnectionProfile, ref: ObjectRef): Promise<TriggerInfo[]> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    return adapter.listTriggers(session, ref);
  }

  async listCheckConstraints(
    profile: ConnectionProfile,
    ref: ObjectRef
  ): Promise<CheckConstraintInfo[]> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    return adapter.listCheckConstraints(session, ref);
  }

  async getObjectDDL(profile: ConnectionProfile, ref: ObjectRef): Promise<string> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    return adapter.getObjectDDL(session, ref);
  }

  async listViewDependencies(profile: ConnectionProfile, ref: ObjectRef): Promise<ObjectRef[]> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    return adapter.listViewDependencies(session, ref);
  }
}
