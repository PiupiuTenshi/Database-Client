import * as vscode from "vscode";
import { DbTreeNode } from "./DbTreeNode";

/** Node hiển thị lỗi khi load children thất bại (vd: mở file SQLite hỏng). */
export class ErrorNode extends DbTreeNode {
  constructor(private readonly message: string) {
    super();
  }

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.message, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon("error", new vscode.ThemeColor("errorForeground"));
    item.tooltip = this.message;
    return item;
  }
}
