import * as vscode from "vscode";
import { isFileBasedDb } from "../core/constants";
import type { ConnectionDraft, ConnectionProfile, TestConnectionResult } from "../core/types";
import type { ProfileStore } from "../storage/ProfileStore";
import type { SecretStore } from "../storage/SecretStore";
import { maskSecret } from "../utils/maskSecret";
import { newId } from "../utils/objectId";

/** Logger tối thiểu để ConnectionService không phụ thuộc cứng vào LogService. */
export interface Logger {
  info(message: string): void;
  error(message: string): void;
}

/**
 * Điều phối lưu/sửa/xóa/test connection.
 *
 * - Metadata profile -> ProfileStore (globalState).
 * - Password -> SecretStore (SecretStorage).
 * - testConnection ở Phase 2 là mock (validate field). Kết nối thật đến từ
 *   adapter ở Phase 3 trở đi.
 */
export class ConnectionService implements vscode.Disposable {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeProfiles: vscode.Event<void> = this.changeEmitter.event;

  constructor(
    private readonly profileStore: ProfileStore,
    private readonly secretStore: SecretStore,
    private readonly logger: Logger,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  listProfiles(): ConnectionProfile[] {
    return this.profileStore.list();
  }

  getProfile(id: string): ConnectionProfile | undefined {
    return this.profileStore.get(id);
  }

  async createProfile(draft: ConnectionDraft, password?: string): Promise<ConnectionProfile> {
    const timestamp = this.now();
    const profile: ConnectionProfile = {
      ...normalizeDraft(draft),
      id: newId(),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.profileStore.save(profile);
    if (password) {
      await this.secretStore.setPassword(profile.id, password);
    }
    this.logger.info(
      `Created connection "${profile.name}" (${profile.dbType}) password=${maskSecret(password)}`
    );
    this.changeEmitter.fire();
    return profile;
  }

  async updateProfile(
    id: string,
    draft: ConnectionDraft,
    password?: string
  ): Promise<ConnectionProfile | undefined> {
    const existing = this.profileStore.get(id);
    if (!existing) {
      return undefined;
    }
    const profile: ConnectionProfile = {
      ...existing,
      ...normalizeDraft(draft),
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: this.now()
    };
    await this.profileStore.save(profile);
    // Trong edit mode: chỉ cập nhật password khi người dùng nhập giá trị mới.
    if (password) {
      await this.secretStore.setPassword(profile.id, password);
    }
    this.logger.info(`Updated connection "${profile.name}" (${profile.dbType})`);
    this.changeEmitter.fire();
    return profile;
  }

  async deleteProfile(id: string): Promise<boolean> {
    const existing = this.profileStore.get(id);
    const removed = await this.profileStore.remove(id);
    if (removed) {
      await this.secretStore.deletePassword(id);
      this.logger.info(`Deleted connection "${existing?.name ?? id}"`);
      this.changeEmitter.fire();
    }
    return removed;
  }

  /**
   * Phase 2: chỉ kiểm tra field bắt buộc (mock). Kết nối thật sẽ thay thế hàm
   * này khi adapter layer sẵn sàng (Phase 3+).
   */
  testConnection(draft: ConnectionDraft): TestConnectionResult {
    if (!draft.name.trim()) {
      return { ok: false, message: "Name is required." };
    }
    if (isFileBasedDb(draft.dbType)) {
      if (!draft.filePath?.trim()) {
        return { ok: false, message: `${draft.dbType} requires a file path.` };
      }
    } else if (!draft.host?.trim()) {
      return { ok: false, message: `${draft.dbType} requires a host.` };
    }
    return {
      ok: true,
      message: `Configuration looks valid (mock check — real connectivity arrives with the ${draft.dbType} adapter).`
    };
  }

  dispose(): void {
    this.changeEmitter.dispose();
  }
}

function normalizeDraft(
  draft: ConnectionDraft
): Omit<ConnectionProfile, "id" | "createdAt" | "updatedAt"> {
  return {
    name: draft.name.trim(),
    dbType: draft.dbType,
    host: emptyToUndefined(draft.host),
    port: draft.port,
    username: emptyToUndefined(draft.username),
    database: emptyToUndefined(draft.database),
    filePath: emptyToUndefined(draft.filePath),
    environment: draft.environment,
    tags: draft.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0),
    ssl: draft.ssl ?? false
  };
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
