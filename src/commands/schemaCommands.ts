import * as vscode from "vscode";
import { COMMANDS } from "../core/constants";
import type { DataEditService } from "../services/DataEditService";
import type { DependencyGraphService } from "../services/DependencyGraphService";
import type { ExportService } from "../services/ExportService";
import type { ImportService } from "../services/ImportService";
import type { QueryService } from "../services/QueryService";
import type { SchemaService } from "../services/SchemaService";
import { TableNode } from "../views/databaseExplorer/nodes/tableNodes";
import { DependencyGraphPanel } from "../webviews/dependencyGraph/DependencyGraphPanel";
import { TableDataPanel, type ObjectPanelDeps } from "../webviews/tableViewer/TableDataPanel";

/** Trích các service mà Object panel cần từ deps chung. */
function toObjectPanelDeps(deps: SchemaCommandDeps): ObjectPanelDeps {
  return {
    queryService: deps.queryService,
    schemaService: deps.schemaService,
    dataEditService: deps.dataEditService,
    exportService: deps.exportService,
    importService: deps.importService
  };
}

export interface SchemaCommandDeps {
  queryService: QueryService;
  schemaService: SchemaService;
  dataEditService: DataEditService;
  exportService: ExportService;
  importService: ImportService;
  graphService: DependencyGraphService;
}

export function registerSchemaCommands(
  context: vscode.ExtensionContext,
  deps: SchemaCommandDeps
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.openTableData, (node?: TableNode) => {
      if (node instanceof TableNode) {
        TableDataPanel.show(toObjectPanelDeps(deps), node.profile, node.ref);
      }
    }),

    vscode.commands.registerCommand(COMMANDS.openDependencyGraph, (node?: TableNode) => {
      if (node instanceof TableNode) {
        DependencyGraphPanel.show(
          { graphService: deps.graphService, ...toObjectPanelDeps(deps) },
          node.profile,
          node.ref
        );
      }
    }),

    vscode.commands.registerCommand(COMMANDS.openDependencyReport, async (node?: TableNode) => {
      if (!(node instanceof TableNode)) {
        return;
      }
      const markdown = await deps.graphService.buildReport(node.profile, node.ref);
      const doc = await vscode.workspace.openTextDocument({
        language: "markdown",
        content: markdown
      });
      await vscode.window.showTextDocument(doc);
    })
  );
}
