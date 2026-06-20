import * as vscode from "vscode";
import { COMMANDS } from "../core/constants";
import {
  DELETE_CONFIRM_ACTION,
  getConnectionRemovedMessage,
  getDeleteConnectionConfirm
} from "../core/messages";
import type { ConnectionService } from "../services/ConnectionService";
import type { LogService } from "../services/LogService";
import type { DatabaseTreeProvider } from "../views/databaseExplorer/DatabaseTreeProvider";
import { ConnectionNode } from "../views/databaseExplorer/nodes/ConnectionNode";
import { ConnectionFormPanel } from "../webviews/connectionForm/ConnectionFormPanel";

export interface CommandDeps {
  connectionService: ConnectionService;
  treeProvider: DatabaseTreeProvider;
  logService: LogService;
}

export function registerConnectionCommands(
  context: vscode.ExtensionContext,
  deps: CommandDeps
): void {
  const { connectionService, treeProvider, logService } = deps;

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.addConnection, () => {
      ConnectionFormPanel.show(connectionService);
    }),

    vscode.commands.registerCommand(COMMANDS.editConnection, (node?: ConnectionNode) => {
      if (node instanceof ConnectionNode) {
        ConnectionFormPanel.show(connectionService, node.profile);
      }
    }),

    vscode.commands.registerCommand(COMMANDS.deleteConnection, async (node?: ConnectionNode) => {
      if (!(node instanceof ConnectionNode)) {
        return;
      }
      const choice = await vscode.window.showWarningMessage(
        getDeleteConnectionConfirm(node.profile.name),
        { modal: true },
        DELETE_CONFIRM_ACTION
      );
      if (choice !== DELETE_CONFIRM_ACTION) {
        return;
      }
      const removed = await connectionService.deleteProfile(node.profile.id);
      if (removed) {
        void vscode.window.showInformationMessage(getConnectionRemovedMessage(node.profile.name));
      }
    }),

    vscode.commands.registerCommand(COMMANDS.testConnection, (node?: ConnectionNode) => {
      if (!(node instanceof ConnectionNode)) {
        return;
      }
      const result = connectionService.testConnection(node.profile);
      logService.info(`Test connection "${node.profile.name}": ${result.message}`);
      if (result.ok) {
        void vscode.window.showInformationMessage(result.message);
      } else {
        void vscode.window.showErrorMessage(result.message);
      }
    }),

    vscode.commands.registerCommand(COMMANDS.refreshConnections, () => {
      treeProvider.refresh();
    })
  );
}
