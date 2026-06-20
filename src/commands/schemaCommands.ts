import * as vscode from "vscode";
import { COMMANDS } from "../core/constants";
import type { DataEditService } from "../services/DataEditService";
import type { DependencyGraphService } from "../services/DependencyGraphService";
import type { ExportService } from "../services/ExportService";
import type { GeneratorService } from "../services/GeneratorService";
import type { ImportService } from "../services/ImportService";
import type { QueryService } from "../services/QueryService";
import type { SchemaService } from "../services/SchemaService";
import { type CodeTarget } from "../utils/codeGen";
import { productionWriteWarning } from "../utils/productionGuard";
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
  generatorService: GeneratorService;
  graphService: DependencyGraphService;
}

const CODE_TARGETS: { label: string; target: CodeTarget }[] = [
  { label: "TypeScript interface", target: "typescript" },
  { label: "C# entity class", target: "csharp" },
  { label: "CRUD SQL", target: "crud" }
];

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

    vscode.commands.registerCommand(COMMANDS.generateCode, async (node?: TableNode) => {
      if (!(node instanceof TableNode)) {
        return;
      }
      const picked = await vscode.window.showQuickPick(
        CODE_TARGETS.map((option) => option.label),
        { placeHolder: `Generate code from ${node.ref.name}` }
      );
      const target = CODE_TARGETS.find((option) => option.label === picked)?.target;
      if (!target) {
        return;
      }
      const { content, language } = await deps.generatorService.generateCode(
        node.profile,
        node.ref,
        target
      );
      const doc = await vscode.workspace.openTextDocument({ language, content });
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand(COMMANDS.generateMockData, async (node?: TableNode) => {
      if (!(node instanceof TableNode)) {
        return;
      }
      const input = await vscode.window.showInputBox({
        prompt: `How many mock rows to insert into ${node.ref.name}?`,
        value: "20",
        validateInput: (value) =>
          /^\d+$/.test(value.trim()) && Number(value) > 0 ? undefined : "Enter a positive integer."
      });
      if (!input) {
        return;
      }
      const count = Number(input.trim());
      const warning = productionWriteWarning(node.profile, "insert");
      if (warning) {
        const choice = await vscode.window.showWarningMessage(
          warning,
          { modal: true },
          "Run anyway"
        );
        if (choice !== "Run anyway") {
          return;
        }
      }
      const result = await deps.generatorService.generateMockData(node.profile, node.ref, {
        count
      });
      const errorNote = result.errors.length ? ` (${result.errors.length} error(s))` : "";
      void vscode.window.showInformationMessage(
        `Inserted ${result.inserted} mock row(s) into ${node.ref.name}${errorNote}.`
      );
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
