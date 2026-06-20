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
      await showHistory(queryDocs, historyStore);
    })
  );
}

interface HistoryQuickItem extends vscode.QuickPickItem {
  itemId: string;
  connectionId: string;
  sql: string;
}

const STAR = "$(star-full)";
const STAR_EMPTY = "$(star-empty)";

/** QuickPick lịch sử có favorite, xóa một mục và xóa toàn bộ; lọc bằng ô tìm kiếm. */
async function showHistory(
  queryDocs: QueryDocumentService,
  historyStore: QueryHistoryStore
): Promise<void> {
  const favoriteButton: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon("star-full"),
    tooltip: "Toggle favorite"
  };
  const removeButton: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon("trash"),
    tooltip: "Remove from history"
  };
  const clearAllButton: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon("clear-all"),
    tooltip: "Clear all history"
  };

  const pick = vscode.window.createQuickPick<HistoryQuickItem>();
  pick.title = "Query History";
  pick.placeholder = "Type to filter · ⭐ toggle favorite · 🗑 remove";
  pick.matchOnDescription = true;
  pick.buttons = [clearAllButton];

  const refresh = (): void => {
    const items = historyStore.list();
    if (items.length === 0) {
      pick.items = [];
    }
    pick.items = items.map((item) => ({
      label: `${item.favorite ? STAR : STAR_EMPTY} ${item.sql.replace(/\s+/g, " ").slice(0, 80)}`,
      description: `${item.connectionName} · ${item.status}${
        item.rowCount === undefined ? "" : ` · ${item.rowCount} rows`
      }`,
      detail: item.createdAt,
      buttons: [favoriteButton, removeButton],
      itemId: item.id,
      connectionId: item.connectionId,
      sql: item.sql
    }));
  };
  refresh();

  pick.onDidTriggerItemButton(async (event) => {
    if (event.button === favoriteButton) {
      await historyStore.toggleFavorite(event.item.itemId);
    } else if (event.button === removeButton) {
      await historyStore.remove(event.item.itemId);
    }
    refresh();
  });

  pick.onDidTriggerButton(async (button) => {
    if (button === clearAllButton) {
      await historyStore.clear();
      refresh();
    }
  });

  pick.onDidAccept(() => {
    const selected = pick.selectedItems[0];
    pick.hide();
    if (selected) {
      void openHistoryQuery(queryDocs, selected.connectionId, selected.sql);
    }
  });

  pick.onDidHide(() => pick.dispose());
  pick.show();
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
