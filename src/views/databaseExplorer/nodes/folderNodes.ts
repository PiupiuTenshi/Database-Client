import * as vscode from "vscode";
import type { ConnectionProfile } from "../../../core/types";
import { DbTreeNode, type TreeContext } from "./DbTreeNode";
import { TableNode } from "./tableNodes";
import { safeChildren } from "./treeHelpers";

/** Node một schema (Postgres/SQL Server) -> Tables + Views của schema đó. */
export class SchemaNode extends DbTreeNode {
  constructor(
    private readonly profile: ConnectionProfile,
    private readonly schema: string
  ) {
    super();
  }

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.schema, vscode.TreeItemCollapsibleState.Collapsed);
    item.iconPath = new vscode.ThemeIcon("symbol-namespace");
    return item;
  }

  getChildren(): DbTreeNode[] {
    return [
      new TablesFolderNode(this.profile, this.schema),
      new ViewsFolderNode(this.profile, this.schema)
    ];
  }
}

export class TablesFolderNode extends DbTreeNode {
  constructor(
    private readonly profile: ConnectionProfile,
    private readonly schema?: string
  ) {
    super();
  }

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem("Tables", vscode.TreeItemCollapsibleState.Collapsed);
    item.iconPath = new vscode.ThemeIcon("list-flat");
    return item;
  }

  getChildren(context: TreeContext): Promise<DbTreeNode[]> {
    return safeChildren(async () => {
      const tables = await context.schemaService.listTables(this.profile, this.schema);
      return tables.map((table) => new TableNode(this.profile, table));
    }, "No tables");
  }
}

export class ViewsFolderNode extends DbTreeNode {
  constructor(
    private readonly profile: ConnectionProfile,
    private readonly schema?: string
  ) {
    super();
  }

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem("Views", vscode.TreeItemCollapsibleState.Collapsed);
    item.iconPath = new vscode.ThemeIcon("eye");
    return item;
  }

  getChildren(context: TreeContext): Promise<DbTreeNode[]> {
    return safeChildren(async () => {
      const views = await context.schemaService.listViews(this.profile, this.schema);
      return views.map((view) => new TableNode(this.profile, view));
    }, "No views");
  }
}
