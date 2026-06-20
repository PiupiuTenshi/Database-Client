import * as vscode from "vscode";
import type { ConnectionProfile } from "../core/types";
import type { ConnectionService } from "./ConnectionService";

/**
 * Gắn một SQL document (theo uri) với một connection profile, để Run query biết
 * chạy trên kết nối nào. Phát sự kiện để status bar cập nhật.
 */
export class QueryDocumentService implements vscode.Disposable {
  private readonly bindings = new Map<string, string>();
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeBindings: vscode.Event<void> = this.changeEmitter.event;

  constructor(private readonly connectionService: ConnectionService) {}

  bind(uri: vscode.Uri, profileId: string): void {
    this.bindings.set(uri.toString(), profileId);
    this.changeEmitter.fire();
  }

  getProfile(uri: vscode.Uri): ConnectionProfile | undefined {
    const profileId = this.bindings.get(uri.toString());
    return profileId ? this.connectionService.getProfile(profileId) : undefined;
  }

  /** Cho người dùng chọn connection từ QuickPick. */
  async pickConnection(): Promise<ConnectionProfile | undefined> {
    const profiles = this.connectionService.listProfiles();
    if (profiles.length === 0) {
      void vscode.window.showWarningMessage("No connections yet. Add a connection first.");
      return undefined;
    }
    const picked = await vscode.window.showQuickPick(
      profiles.map((profile) => ({
        label: profile.name,
        description: `${profile.dbType}${profile.environment !== "local" ? ` · ${profile.environment}` : ""}`,
        profile
      })),
      { placeHolder: "Select a connection for this query" }
    );
    return picked?.profile;
  }

  /** Lấy profile đã bind, hoặc hỏi chọn rồi bind. */
  async resolveProfile(uri: vscode.Uri): Promise<ConnectionProfile | undefined> {
    const existing = this.getProfile(uri);
    if (existing) {
      return existing;
    }
    const picked = await this.pickConnection();
    if (picked) {
      this.bind(uri, picked.id);
    }
    return picked;
  }

  dispose(): void {
    this.changeEmitter.dispose();
  }
}
