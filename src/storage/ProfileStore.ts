import type * as vscode from "vscode";
import type { ConnectionProfile } from "../core/types";

const STORAGE_KEY = "openDbNexus.connections";

/**
 * Lưu danh sách ConnectionProfile (metadata, KHÔNG có password) vào globalState.
 * Chỉ phụ thuộc interface vscode.Memento nên unit test được với memento giả.
 */
export class ProfileStore {
  constructor(private readonly memento: vscode.Memento) {}

  list(): ConnectionProfile[] {
    return this.memento.get<ConnectionProfile[]>(STORAGE_KEY, []);
  }

  get(id: string): ConnectionProfile | undefined {
    return this.list().find((profile) => profile.id === id);
  }

  async save(profile: ConnectionProfile): Promise<void> {
    const profiles = this.list();
    const index = profiles.findIndex((existing) => existing.id === profile.id);
    if (index >= 0) {
      profiles[index] = profile;
    } else {
      profiles.push(profile);
    }
    await this.memento.update(STORAGE_KEY, profiles);
  }

  async remove(id: string): Promise<boolean> {
    const profiles = this.list();
    const next = profiles.filter((profile) => profile.id !== id);
    if (next.length === profiles.length) {
      return false;
    }
    await this.memento.update(STORAGE_KEY, next);
    return true;
  }
}
