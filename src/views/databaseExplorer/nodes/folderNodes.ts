import * as vscode from "vscode";
import type { ConnectionProfile } from "../../../core/types";
import { DbTreeNode, type TreeContext } from "./DbTreeNode";
import { TableNode } from "./tableNodes";
import { safeChildren } from "./treeHelpers";

export class TablesFolderNode extends DbTreeNode {
  constructor(private readonly profile: ConnectionProfile) {
    super();
  }

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem("Tables", vscode.TreeItemCollapsibleState.Collapsed);
    item.iconPath = new vscode.ThemeIcon("list-flat");
    return item;
  }

  getChildren(context: TreeContext): Promise<DbTreeNode[]> {
    return safeChildren(async () => {
      const tables = await context.schemaService.listTables(this.profile);
      return tables.map((table) => new TableNode(this.profile, table));
    }, "No tables");
  }
}

export class ViewsFolderNode extends DbTreeNode {
  constructor(private readonly profile: ConnectionProfile) {
    super();
  }

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem("Views", vscode.TreeItemCollapsibleState.Collapsed);
    item.iconPath = new vscode.ThemeIcon("eye");
    return item;
  }

  getChildren(context: TreeContext): Promise<DbTreeNode[]> {
    return safeChildren(async () => {
      const views = await context.schemaService.listViews(this.profile);
      return views.map((view) => new TableNode(this.profile, view));
    }, "No views");
  }
}
