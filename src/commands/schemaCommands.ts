import * as vscode from "vscode";
import { COMMANDS } from "../core/constants";
import type { DependencyGraphService } from "../services/DependencyGraphService";
import type { QueryService } from "../services/QueryService";
import { TableNode } from "../views/databaseExplorer/nodes/tableNodes";
import { DependencyGraphPanel } from "../webviews/dependencyGraph/DependencyGraphPanel";
import { TableDataPanel } from "../webviews/tableViewer/TableDataPanel";

export interface SchemaCommandDeps {
  queryService: QueryService;
  graphService: DependencyGraphService;
}

export function registerSchemaCommands(
  context: vscode.ExtensionContext,
  deps: SchemaCommandDeps
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.openTableData, (node?: TableNode) => {
      if (node instanceof TableNode) {
        TableDataPanel.show(deps.queryService, node.profile, node.ref);
      }
    }),

    vscode.commands.registerCommand(COMMANDS.openDependencyGraph, (node?: TableNode) => {
      if (node instanceof TableNode) {
        DependencyGraphPanel.show(
          { graphService: deps.graphService, queryService: deps.queryService },
          node.profile,
          node.ref
        );
      }
    })
  );
}
