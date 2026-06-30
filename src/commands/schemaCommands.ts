import * as vscode from "vscode";
import { COMMANDS } from "../core/constants";
import type { BackupService } from "../services/BackupService";
import type { DashboardService } from "../services/DashboardService";
import type { DataEditService } from "../services/DataEditService";
import type { DependencyGraphService } from "../services/DependencyGraphService";
import type { ExportService } from "../services/ExportService";
import type { GeneratorService } from "../services/GeneratorService";
import type { ImportService } from "../services/ImportService";
import type { PolicyService } from "../services/PolicyService";
import type { QueryService } from "../services/QueryService";
import type { SchemaSearchService } from "../services/SchemaSearchService";
import type { SchemaService } from "../services/SchemaService";
import { type CodeTarget } from "../utils/codeGen";
import { productionWriteWarning } from "../utils/productionGuard";
import { ConnectionNode } from "../views/databaseExplorer/nodes/ConnectionNode";
import { TableNode } from "../views/databaseExplorer/nodes/tableNodes";
import { DashboardPanel } from "../webviews/dashboard/DashboardPanel";
import { DependencyGraphPanel } from "../webviews/dependencyGraph/DependencyGraphPanel";
import { TableDataPanel, type ObjectPanelDeps } from "../webviews/tableViewer/TableDataPanel";

/** Trích các service mà Object panel cần từ deps chung. */
function toObjectPanelDeps(deps: SchemaCommandDeps): ObjectPanelDeps {
  return {
    queryService: deps.queryService,
    schemaService: deps.schemaService,
    dataEditService: deps.dataEditService,
    exportService: deps.exportService,
    importService: deps.importService,
    policyService: deps.policyService
  };
}

export interface SchemaCommandDeps {
  queryService: QueryService;
  schemaService: SchemaService;
  dataEditService: DataEditService;
  exportService: ExportService;
  importService: ImportService;
  generatorService: GeneratorService;
  backupService: BackupService;
  dashboardService: DashboardService;
  policyService: PolicyService;
  schemaSearchService: SchemaSearchService;
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

    vscode.commands.registerCommand(COMMANDS.openDashboard, (node?: ConnectionNode) => {
      if (node instanceof ConnectionNode) {
        DashboardPanel.show(deps.dashboardService, node.profile, node.profile.database);
      }
    }),

    vscode.commands.registerCommand(COMMANDS.backupConnection, async (node?: ConnectionNode) => {
      if (!(node instanceof ConnectionNode)) {
        return;
      }
      const profile = node.profile;
      try {
        deps.policyService.assertExportAllowed(profile);
      } catch (error) {
        void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
        return;
      }
      const target = await vscode.window.showSaveDialog({
        filters: { SQL: ["sql"] },
        saveLabel: "Export SQL",
        defaultUri: vscode.Uri.file(`${safeFileName(profile.name)}-database.sql`)
      });
      if (!target) {
        return;
      }
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Backing up ${profile.name}…` },
        async (progress) => {
          const sql = await deps.backupService.backup(profile, undefined, (p) => {
            progress.report({
              message: `${p.current}/${p.total} | ${p.table}`,
              increment: 100 / Math.max(1, p.total)
            });
          });
          await vscode.workspace.fs.writeFile(target, Buffer.from(sql, "utf8"));
        }
      );
      void vscode.window.showInformationMessage(`Database SQL exported to ${target.fsPath}.`);
    }),

    vscode.commands.registerCommand(COMMANDS.searchSchema, async (node?: ConnectionNode) => {
      if (!(node instanceof ConnectionNode)) {
        return;
      }
      const profile = node.profile;
      const term = await vscode.window.showInputBox({
        prompt: `Search tables, views and columns in ${profile.name}`,
        placeHolder: "name fragment…"
      });
      if (!term) {
        return;
      }
      const hits = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Window, title: "Searching schema…" },
        () => deps.schemaSearchService.search(profile, profile.database, term)
      );
      if (hits.length === 0) {
        void vscode.window.showInformationMessage(`No schema objects match "${term}".`);
        return;
      }
      const picked = await vscode.window.showQuickPick(
        hits.map((hit) => ({
          label:
            hit.kind === "column"
              ? `$(symbol-field) ${hit.table}.${hit.column}`
              : `$(table) ${hit.table}`,
          description: hit.kind,
          hit
        })),
        { placeHolder: `${hits.length} match(es) — pick to open the table` }
      );
      if (picked) {
        TableDataPanel.show(toObjectPanelDeps(deps), profile, {
          schema: picked.hit.schema,
          name: picked.hit.table
        });
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

function safeFileName(value: string): string {
  const cleaned = [...value.trim()]
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || '<>:"/\\|?*'.includes(char) ? "_" : char;
    })
    .join("");
  return cleaned || "database";
}
