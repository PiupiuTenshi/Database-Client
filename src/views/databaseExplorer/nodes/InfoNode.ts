import * as vscode from "vscode";
import { CONTEXT_VALUES } from "../../../core/constants";
import { DbTreeNode } from "./DbTreeNode";

/** Node thông tin/placeholder, không có con và không có hành động. */
export class InfoNode extends DbTreeNode {
  constructor(private readonly label: string) {
    super();
  }

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon("info");
    item.contextValue = CONTEXT_VALUES.info;
    return item;
  }
}
