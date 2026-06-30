import * as vscode from "vscode";
import { COMMANDS, CONTEXT_VALUES } from "../../../core/constants";
import type { ConnectionProfile, ObjectRef, TableInfo } from "../../../core/types";
import { DbTreeNode, type TreeContext } from "./DbTreeNode";
import { ColumnNode, ForeignKeyNode, IndexNode } from "./leafNodes";
import { safeChildren } from "./treeHelpers";

/** Node một table/view; mở ra Columns / Indexes / Foreign Keys. */
export class TableNode extends DbTreeNode {
  readonly ref: ObjectRef;

  constructor(
    readonly profile: ConnectionProfile,
    private readonly table: TableInfo
  ) {
    super();
    this.ref = { name: table.name, schema: table.schema };
  }

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.table.name, vscode.TreeItemCollapsibleState.Collapsed);
    item.id = `${this.profile.id}:table:${this.ref.schema ?? "default"}:${this.ref.name}`;
    item.contextValue = CONTEXT_VALUES.table;
    item.iconPath =
      this.table.type === "view"
        ? new vscode.ThemeIcon("eye", new vscode.ThemeColor("charts.purple"))
        : new vscode.ThemeIcon("table", new vscode.ThemeColor("charts.green"));
    item.command = {
      command: COMMANDS.openTableData,
      title: "Open Table",
      arguments: [this]
    };
    item.tooltip =
      this.table.type === "view"
        ? `Open view ${this.qualifiedName()}`
        : `Open table ${this.qualifiedName()}`;
    return item;
  }

  private qualifiedName(): string {
    return this.ref.schema ? `${this.ref.schema}.${this.ref.name}` : this.ref.name;
  }

  cacheKey(): string {
    return `table:${this.profile.id}:${this.ref.schema ?? "default"}:${this.ref.name}`;
  }

  getChildren(): DbTreeNode[] {
    return [
      new ColumnsFolderNode(this.profile, this.ref),
      new IndexesFolderNode(this.profile, this.ref),
      new ForeignKeysFolderNode(this.profile, this.ref)
    ];
  }
}

class ColumnsFolderNode extends DbTreeNode {
  constructor(
    private readonly profile: ConnectionProfile,
    private readonly ref: ObjectRef
  ) {
    super();
  }

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem("Columns", vscode.TreeItemCollapsibleState.Collapsed);
    item.id = `${this.profile.id}:columns:${this.ref.schema ?? "default"}:${this.ref.name}`;
    item.iconPath = new vscode.ThemeIcon("symbol-field", new vscode.ThemeColor("charts.blue"));
    return item;
  }

  cacheKey(): string {
    return `columns:${this.profile.id}:${this.ref.schema ?? "default"}:${this.ref.name}`;
  }

  getChildren(context: TreeContext): Promise<DbTreeNode[]> {
    return safeChildren(async () => {
      const columns = await context.schemaService.listColumns(this.profile, this.ref);
      return columns.map((column) => new ColumnNode(column));
    }, "No columns");
  }
}

class IndexesFolderNode extends DbTreeNode {
  constructor(
    private readonly profile: ConnectionProfile,
    private readonly ref: ObjectRef
  ) {
    super();
  }

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem("Indexes", vscode.TreeItemCollapsibleState.Collapsed);
    item.id = `${this.profile.id}:indexes:${this.ref.schema ?? "default"}:${this.ref.name}`;
    item.iconPath = new vscode.ThemeIcon("list-ordered", new vscode.ThemeColor("charts.yellow"));
    return item;
  }

  cacheKey(): string {
    return `indexes:${this.profile.id}:${this.ref.schema ?? "default"}:${this.ref.name}`;
  }

  getChildren(context: TreeContext): Promise<DbTreeNode[]> {
    return safeChildren(async () => {
      const indexes = await context.schemaService.listIndexes(this.profile, this.ref);
      return indexes.map((index) => new IndexNode(index));
    }, "No indexes");
  }
}

class ForeignKeysFolderNode extends DbTreeNode {
  constructor(
    private readonly profile: ConnectionProfile,
    private readonly ref: ObjectRef
  ) {
    super();
  }

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem("Foreign Keys", vscode.TreeItemCollapsibleState.Collapsed);
    item.id = `${this.profile.id}:foreignKeys:${this.ref.schema ?? "default"}:${this.ref.name}`;
    item.iconPath = new vscode.ThemeIcon("references", new vscode.ThemeColor("charts.orange"));
    return item;
  }

  cacheKey(): string {
    return `foreignKeys:${this.profile.id}:${this.ref.schema ?? "default"}:${this.ref.name}`;
  }

  getChildren(context: TreeContext): Promise<DbTreeNode[]> {
    return safeChildren(async () => {
      const fks = await context.schemaService.listForeignKeys(this.profile, this.ref);
      return fks.map((fk) => new ForeignKeyNode(fk));
    }, "No foreign keys");
  }
}
