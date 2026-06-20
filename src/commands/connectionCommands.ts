import * as vscode from "vscode";
import { COMMANDS } from "../core/constants";
import {
  ADD_CONNECTION_PLACEHOLDER,
  ADD_CONNECTION_PROMPT,
  getConnectionAddedMessage,
  getConnectionRemovedMessage
} from "../core/messages";
import type { ConnectionService } from "../services/ConnectionService";
import type { DatabaseTreeProvider } from "../views/databaseExplorer/DatabaseTreeProvider";
import { ConnectionNode } from "../views/databaseExplorer/nodes/ConnectionNode";

export interface CommandDeps {
  connectionService: ConnectionService;
  treeProvider: DatabaseTreeProvider;
}

export function registerConnectionCommands(
  context: vscode.ExtensionContext,
  deps: CommandDeps
): void {
  const { connectionService, treeProvider } = deps;

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.addConnection, async () => {
      const name = await vscode.window.showInputBox({
        prompt: ADD_CONNECTION_PROMPT,
        placeHolder: ADD_CONNECTION_PLACEHOLDER,
        validateInput: (value) => (value.trim().length === 0 ? "Name is required." : undefined)
      });
      if (name === undefined) {
        return;
      }
      const profile = connectionService.addMockProfile(name.trim());
      void vscode.window.showInformationMessage(getConnectionAddedMessage(profile.name));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.refreshConnections, () => {
      treeProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.removeConnection, (node?: ConnectionNode) => {
      if (!(node instanceof ConnectionNode)) {
        return;
      }
      const removed = connectionService.removeProfile(node.profile.id);
      if (removed) {
        void vscode.window.showInformationMessage(getConnectionRemovedMessage(node.profile.name));
      }
    })
  );
}
