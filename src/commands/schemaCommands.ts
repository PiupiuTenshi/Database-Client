import * as vscode from "vscode";
import { COMMANDS } from "../core/constants";
import type { QueryService } from "../services/QueryService";
import { TableNode } from "../views/databaseExplorer/nodes/tableNodes";
import { TableDataPanel } from "../webviews/tableViewer/TableDataPanel";

export function registerSchemaCommands(
  context: vscode.ExtensionContext,
  queryService: QueryService
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.openTableData, (node?: TableNode) => {
      if (node instanceof TableNode) {
        TableDataPanel.show(queryService, node.profile, node.ref);
      }
    })
  );
}
