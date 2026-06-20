import type * as vscode from "vscode";

/**
 * Bọc VS Code SecretStorage cho password của connection.
 * Password chỉ tồn tại ở đây, KHÔNG bao giờ ở ProfileStore/globalState/log.
 */
export class SecretStore {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  private passwordKey(connectionId: string): string {
    return `openDbNexus.connection.${connectionId}.password`;
  }

  getPassword(connectionId: string): Thenable<string | undefined> {
    return this.secrets.get(this.passwordKey(connectionId));
  }

  async setPassword(connectionId: string, password: string): Promise<void> {
    await this.secrets.store(this.passwordKey(connectionId), password);
  }

  async deletePassword(connectionId: string): Promise<void> {
    await this.secrets.delete(this.passwordKey(connectionId));
  }
}
