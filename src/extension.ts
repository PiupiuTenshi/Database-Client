import * as vscode from "vscode";
import { registerCommands } from "./commands/registerCommands";
import { EXTENSION_DISPLAY_NAME, VIEWS } from "./core/constants";
import { ConnectionService } from "./services/ConnectionService";
import { LogService } from "./services/LogService";
import { ProfileStore } from "./storage/ProfileStore";
import { SecretStore } from "./storage/SecretStore";
import { DatabaseTreeProvider } from "./views/databaseExplorer/DatabaseTreeProvider";
import { registerStatusBar } from "./views/statusBar";

export function activate(context: vscode.ExtensionContext): void {
  const logService = new LogService();
  context.subscriptions.push(logService);

  const profileStore = new ProfileStore(context.globalState);
  const secretStore = new SecretStore(context.secrets);
  const connectionService = new ConnectionService(profileStore, secretStore, logService);
  context.subscriptions.push(connectionService);

  const treeProvider = new DatabaseTreeProvider(connectionService);
  context.subscriptions.push(treeProvider);

  const treeView = vscode.window.createTreeView(VIEWS.connections, {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);

  // Đồng bộ TreeView mỗi khi danh sách connection thay đổi.
  context.subscriptions.push(connectionService.onDidChangeProfiles(() => treeProvider.refresh()));

  registerStatusBar(context, connectionService);
  registerCommands(context, { connectionService, treeProvider, logService });

  logService.info(`${EXTENSION_DISPLAY_NAME} activated.`);
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions from the extension context.
}
