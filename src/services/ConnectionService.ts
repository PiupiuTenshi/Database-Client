import * as vscode from "vscode";
import type { ConnectionProfile, DatabaseDriver } from "../core/types";

/**
 * Quản lý danh sách connection profile.
 *
 * Phase 1: lưu in-memory (mock) để dựng VS Code shell. Phase 2 sẽ thay phần
 * lưu trữ bằng ProfileStore (globalState) + SecretStore (SecretStorage) mà
 * không đổi API public mà TreeView/command đang dùng.
 */
export class ConnectionService implements vscode.Disposable {
  private readonly profiles = new Map<string, ConnectionProfile>();
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private counter = 0;

  /** Phát sự kiện mỗi khi danh sách profile thay đổi (add/remove). */
  readonly onDidChangeProfiles: vscode.Event<void> = this.changeEmitter.event;

  /** Seed vài connection mock để sidebar có nội dung ngay khi mở. */
  seedMockProfiles(): void {
    if (this.profiles.size > 0) {
      return;
    }
    this.addMockProfile("Local SQLite", "sqlite");
    this.addMockProfile("Local PostgreSQL", "postgresql");
  }

  listProfiles(): ConnectionProfile[] {
    return [...this.profiles.values()];
  }

  getProfile(id: string): ConnectionProfile | undefined {
    return this.profiles.get(id);
  }

  addMockProfile(name: string, driver: DatabaseDriver = "sqlite"): ConnectionProfile {
    this.counter += 1;
    const profile: ConnectionProfile = { id: `conn-${this.counter}`, name, driver };
    this.profiles.set(profile.id, profile);
    this.changeEmitter.fire();
    return profile;
  }

  /** Trả về true nếu thực sự có profile bị xóa. */
  removeProfile(id: string): boolean {
    const removed = this.profiles.delete(id);
    if (removed) {
      this.changeEmitter.fire();
    }
    return removed;
  }

  dispose(): void {
    this.changeEmitter.dispose();
  }
}
