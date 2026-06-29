import * as vscode from "vscode";
import type {
  ConnectionDraft,
  ConnectionProfile,
  RuntimeConnectionProfile,
  TestConnectionResult
} from "../core/types";
import type { AdapterRegistry } from "../adapters/AdapterRegistry";
import type { DatabaseAdapter, DbSession } from "../adapters/DatabaseAdapter";
import type { SecretStore } from "../storage/SecretStore";
import { normalizeConnectionDraft, type Logger } from "./ConnectionService";

interface ActiveSession {
  adapter: DatabaseAdapter;
  session: DbSession;
}

/**
 * Mở và cache phiên kết nối theo profileId. Schema/query service lấy session
 * qua đây. Khi profile thay đổi, gọi disconnectAll để buộc kết nối lại sạch.
 */
export class SessionManager implements vscode.Disposable {
  private readonly active = new Map<string, ActiveSession>();

  constructor(
    private readonly registry: AdapterRegistry,
    private readonly secretStore: SecretStore,
    private readonly logger: Logger
  ) {}

  supports(profile: ConnectionProfile): boolean {
    return this.registry.has(profile.dbType);
  }

  async getOrConnect(profile: ConnectionProfile): Promise<ActiveSession> {
    const existing = this.active.get(profile.id);
    if (existing) {
      return existing;
    }
    const adapter = this.requireAdapter(profile);
    const runtime = await this.toRuntime(profile);
    const session = await adapter.connect(runtime);
    const entry: ActiveSession = { adapter, session };
    this.active.set(profile.id, entry);
    this.logger.info(`Connected "${profile.name}" (${profile.dbType})`);
    return entry;
  }

  /** Test thật nếu có adapter; nếu chưa có adapter thì báo rõ. */
  async testProfile(profile: ConnectionProfile): Promise<TestConnectionResult> {
    const adapter = this.registry.get(profile.dbType);
    if (!adapter) {
      return {
        ok: false,
        message: `No adapter for ${profile.dbType} yet (arrives in a later phase).`
      };
    }
    try {
      const runtime = await this.toRuntime(profile);
      return await adapter.testConnection(runtime);
    } catch (error) {
      return { ok: false, message: toErrorMessage(error) };
    }
  }

  async testDraft(draft: ConnectionDraft, password?: string): Promise<TestConnectionResult> {
    const adapter = this.registry.get(draft.dbType);
    if (!adapter) {
      return {
        ok: false,
        message: `No adapter for ${draft.dbType} yet (arrives in a later phase).`
      };
    }
    try {
      const runtime: RuntimeConnectionProfile = {
        ...normalizeConnectionDraft(draft),
        id: "draft",
        createdAt: "",
        updatedAt: "",
        password
      };
      return await adapter.testConnection(runtime);
    } catch (error) {
      return { ok: false, message: toErrorMessage(error) };
    }
  }

  async disconnect(profileId: string): Promise<void> {
    const entry = this.active.get(profileId);
    if (entry) {
      this.active.delete(profileId);
      await entry.adapter.disconnect(entry.session);
    }
  }

  disconnectAll(): void {
    for (const [id, entry] of this.active) {
      void entry.adapter.disconnect(entry.session);
      this.active.delete(id);
    }
  }

  dispose(): void {
    this.disconnectAll();
  }

  private requireAdapter(profile: ConnectionProfile): DatabaseAdapter {
    const adapter = this.registry.get(profile.dbType);
    if (!adapter) {
      throw new Error(`No adapter registered for ${profile.dbType}.`);
    }
    return adapter;
  }

  private async toRuntime(profile: ConnectionProfile): Promise<RuntimeConnectionProfile> {
    const password = await this.secretStore.getPassword(profile.id);
    return { ...profile, password };
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
