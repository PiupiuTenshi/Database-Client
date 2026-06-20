import * as vscode from "vscode";
import { COMMANDS } from "../core/constants";
import type { ConnectionProfile } from "../core/types";
import type { QueryDocumentService } from "../services/QueryDocumentService";
import type { QueryRunner } from "../services/QueryRunner";
import type { QueryHistoryStore } from "../storage/QueryHistoryStore";
import { findStatementAt } from "../utils/statementSplitter";
import { ConnectionNode } from "../views/databaseExplorer/nodes/ConnectionNode";

export interface QueryCommandDeps {
  queryDocs: QueryDocumentService;
  queryRunner: QueryRunner;
  historyStore: QueryHistoryStore;
}

export function registerQueryCommands(
  context: vscode.ExtensionContext,
  deps: QueryCommandDeps
): void {
  const { queryDocs, queryRunner, historyStore } = deps;

  context.subscriptions.push(
    vscode.commands.registerCommand(
      COMMANDS.openQuery,
      async (arg?: ConnectionNode | ConnectionProfile) => {
        const fromNode = arg instanceof ConnectionNode ? arg.profile : arg;
        const target = fromNode ?? (await queryDocs.pickConnection());
        if (!target) {
          return;
        }
        await openBoundQuery(queryDocs, target, `-- Query on ${target.name}\nSELECT 1;\n`);
      }
    ),

    vscode.commands.registerCommand(COMMANDS.runQuery, async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const profile = await queryDocs.resolveProfile(editor.document.uri);
      if (!profile) {
        return;
      }
      const sql = editor.selection.isEmpty
        ? (findStatementAt(
            editor.document.getText(),
            editor.document.offsetAt(editor.selection.active)
          )?.text ?? "")
        : editor.document.getText(editor.selection);
      await queryRunner.run(profile, sql);
    }),

    vscode.commands.registerCommand(COMMANDS.runAllQueries, async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const profile = await queryDocs.resolveProfile(editor.document.uri);
      if (!profile) {
        return;
      }
      await queryRunner.run(profile, editor.document.getText());
    }),

    vscode.commands.registerCommand(COMMANDS.changeQueryConnection, async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const profile = await queryDocs.pickConnection();
      if (profile) {
        queryDocs.bind(editor.document.uri, profile.id);
      }
    }),

    vscode.commands.registerCommand(COMMANDS.showQueryHistory, async () => {
      const items = historyStore.list();
      if (items.length === 0) {
        void vscode.window.showInformationMessage("No query history yet.");
        return;
      }
      const picked = await vscode.window.showQuickPick(
        items.map((item) => ({
          label: item.sql.replace(/\s+/g, " ").slice(0, 80),
          description: `${item.connectionName} · ${item.status}`,
          detail: item.createdAt,
          item
        })),
        { placeHolder: "Query history — pick to open in a new editor" }
      );
      if (!picked) {
        return;
      }
      await openHistoryQuery(queryDocs, picked.item.connectionId, picked.item.sql);
    })
  );
}

async function openBoundQuery(
  queryDocs: QueryDocumentService,
  profile: ConnectionProfile,
  content: string
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({ language: "sql", content });
  await vscode.window.showTextDocument(doc);
  queryDocs.bind(doc.uri, profile.id);
}

async function openHistoryQuery(
  queryDocs: QueryDocumentService,
  connectionId: string,
  sql: string
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({ language: "sql", content: `${sql}\n` });
  await vscode.window.showTextDocument(doc);
  queryDocs.bind(doc.uri, connectionId);
}
