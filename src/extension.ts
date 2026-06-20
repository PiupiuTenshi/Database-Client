import * as vscode from "vscode";
import { AdapterRegistry } from "./adapters/AdapterRegistry";
import { SqliteAdapter } from "./adapters/sqlite/SqliteAdapter";
import { registerCommands } from "./commands/registerCommands";
import { EXTENSION_DISPLAY_NAME, VIEWS } from "./core/constants";
import { ConnectionService } from "./services/ConnectionService";
import { LogService } from "./services/LogService";
import { QueryService } from "./services/QueryService";
import { SchemaService } from "./services/SchemaService";
import { SessionManager } from "./services/SessionManager";
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

  const registry = new AdapterRegistry();
  registry.register(new SqliteAdapter());

  const sessionManager = new SessionManager(registry, secretStore, logService);
  context.subscriptions.push(sessionManager);
  const schemaService = new SchemaService(sessionManager);
  const queryService = new QueryService(sessionManager);

  const treeProvider = new DatabaseTreeProvider(connectionService, schemaService, sessionManager);
  context.subscriptions.push(treeProvider);

  const treeView = vscode.window.createTreeView(VIEWS.connections, {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);

  // Profile thay đổi -> bỏ session cũ (kết nối lại sạch) + refresh cây.
  context.subscriptions.push(
    connectionService.onDidChangeProfiles(() => {
      sessionManager.disconnectAll();
      treeProvider.refresh();
    })
  );

  registerStatusBar(context, connectionService);
  registerCommands(context, {
    connectionService,
    treeProvider,
    sessionManager,
    queryService,
    logService
  });

  logService.info(`${EXTENSION_DISPLAY_NAME} activated.`);
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions from the extension context.
}
