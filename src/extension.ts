import * as vscode from "vscode";
import { AdapterRegistry } from "./adapters/AdapterRegistry";
import { MySqlAdapter } from "./adapters/mysql/MySqlAdapter";
import { PostgresAdapter } from "./adapters/postgresql/PostgresAdapter";
import { RedisAdapter } from "./adapters/redis/RedisAdapter";
import { SqlServerAdapter } from "./adapters/sqlserver/SqlServerAdapter";
import { SqliteAdapter } from "./adapters/sqlite/SqliteAdapter";
import { registerCommands } from "./commands/registerCommands";
import { EXTENSION_DISPLAY_NAME, VIEWS } from "./core/constants";
import { ConnectionService } from "./services/ConnectionService";
import { DataEditService } from "./services/DataEditService";
import { DependencyGraphService } from "./services/DependencyGraphService";
import { BackupService } from "./services/BackupService";
import { DashboardService } from "./services/DashboardService";
import { ExportService } from "./services/ExportService";
import { GeneratorService } from "./services/GeneratorService";
import { ImportService } from "./services/ImportService";
import { PolicyService } from "./services/PolicyService";
import { SchemaSearchService } from "./services/SchemaSearchService";
import { LogService } from "./services/LogService";
import { QueryDocumentService } from "./services/QueryDocumentService";
import { QueryRunner } from "./services/QueryRunner";
import { QueryService } from "./services/QueryService";
import { SchemaService } from "./services/SchemaService";
import { SessionManager } from "./services/SessionManager";
import { ProfileStore } from "./storage/ProfileStore";
import { QueryHistoryStore } from "./storage/QueryHistoryStore";
import { SecretStore } from "./storage/SecretStore";
import { DatabaseTreeProvider } from "./views/databaseExplorer/DatabaseTreeProvider";
import { registerQueryStatusBar, registerStatusBar } from "./views/statusBar";

export function activate(context: vscode.ExtensionContext): void {
  const logService = new LogService();
  context.subscriptions.push(logService);

  const profileStore = new ProfileStore(context.globalState);
  const secretStore = new SecretStore(context.secrets);
  const connectionService = new ConnectionService(profileStore, secretStore, logService);
  context.subscriptions.push(connectionService);

  const registry = new AdapterRegistry();
  registry.register(new SqliteAdapter());
  registry.register(new PostgresAdapter());
  registry.register(new MySqlAdapter("mysql"));
  registry.register(new MySqlAdapter("mariadb"));
  registry.register(new SqlServerAdapter());
  registry.register(new RedisAdapter());

  const sessionManager = new SessionManager(registry, secretStore, logService);
  context.subscriptions.push(sessionManager);
  const schemaService = new SchemaService(sessionManager);
  const queryService = new QueryService(sessionManager);
  const dataEditService = new DataEditService(sessionManager);
  const exportService = new ExportService(queryService, sessionManager);
  const importService = new ImportService(dataEditService);
  const generatorService = new GeneratorService(schemaService, dataEditService, sessionManager);
  const backupService = new BackupService(schemaService, exportService);
  const dashboardService = new DashboardService(schemaService, queryService);
  const policyService = new PolicyService(() => {
    const config = vscode.workspace.getConfiguration("openDbNexus");
    return {
      disableWriteOnProduction: config.get<boolean>("security.disableWriteOnProduction", false),
      disableExportOnProduction: config.get<boolean>("security.disableExportOnProduction", false),
      maxRows: config.get<number>("query.maxRows", 1000)
    };
  });
  const schemaSearchService = new SchemaSearchService(schemaService);
  const graphService = new DependencyGraphService(schemaService);

  const historyStore = new QueryHistoryStore(context.globalState, () =>
    vscode.workspace.getConfiguration("openDbNexus").get<number>("history.maxItems", 200)
  );
  const queryDocs = new QueryDocumentService(connectionService);
  context.subscriptions.push(queryDocs);
  const queryRunner = new QueryRunner(queryService, historyStore, logService);

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
  registerQueryStatusBar(context, queryDocs);
  registerCommands(context, {
    connectionService,
    treeProvider,
    sessionManager,
    queryService,
    schemaService,
    dataEditService,
    exportService,
    importService,
    generatorService,
    backupService,
    dashboardService,
    policyService,
    schemaSearchService,
    logService,
    queryDocs,
    queryRunner,
    historyStore,
    graphService
  });

  logService.info(`${EXTENSION_DISPLAY_NAME} activated.`);
}

export function deactivate(): void {
  // VS Code disposes registered subscriptions from the extension context.
}
