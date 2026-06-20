import * as vscode from "vscode";
import { COMMANDS } from "../core/constants";
import { getStatusBarText, getStatusBarTooltip } from "../core/messages";
import type { ConnectionService } from "../services/ConnectionService";
import type { QueryDocumentService } from "../services/QueryDocumentService";

/**
 * Tạo status bar item hiển thị số connection và tự cập nhật khi danh sách đổi.
 * Tất cả disposable được push vào context.subscriptions.
 */
export function registerStatusBar(
  context: vscode.ExtensionContext,
  connectionService: ConnectionService
): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  item.command = COMMANDS.addConnection;

  const update = (): void => {
    const count = connectionService.listProfiles().length;
    item.text = getStatusBarText(count);
    item.tooltip = getStatusBarTooltip(count);
  };

  update();
  item.show();

  context.subscriptions.push(item, connectionService.onDidChangeProfiles(update));
  return item;
}

/**
 * Status bar hiển thị connection đang bind với SQL editor đang mở. Click để đổi
 * connection. Chỉ hiện khi editor hiện tại là file SQL.
 */
export function registerQueryStatusBar(
  context: vscode.ExtensionContext,
  queryDocs: QueryDocumentService
): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  item.command = COMMANDS.changeQueryConnection;

  const update = (): void => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "sql") {
      item.hide();
      return;
    }
    const profile = queryDocs.getProfile(editor.document.uri);
    item.text = profile ? `$(database) ${profile.name}` : "$(database) Bind connection";
    item.tooltip = "Open DB Nexus: query connection (click to change)";
    item.show();
  };

  update();

  context.subscriptions.push(
    item,
    vscode.window.onDidChangeActiveTextEditor(update),
    queryDocs.onDidChangeBindings(update)
  );
  return item;
}
