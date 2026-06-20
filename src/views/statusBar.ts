import * as vscode from "vscode";
import { COMMANDS } from "../core/constants";
import { getStatusBarText, getStatusBarTooltip } from "../core/messages";
import type { ConnectionService } from "../services/ConnectionService";

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
