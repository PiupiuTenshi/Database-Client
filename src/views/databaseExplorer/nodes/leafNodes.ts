import * as vscode from "vscode";
import type { ColumnInfo, ForeignKeyInfo, IndexInfo } from "../../../core/types";
import { DbTreeNode } from "./DbTreeNode";

export class ColumnNode extends DbTreeNode {
  constructor(private readonly column: ColumnInfo) {
    super();
  }

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.column.name, vscode.TreeItemCollapsibleState.None);
    const flags = [this.column.dataType];
    if (this.column.isPrimaryKey) {
      flags.push("PK");
    }
    if (!this.column.nullable) {
      flags.push("NOT NULL");
    }
    item.description = flags.filter(Boolean).join(" | ");
    item.iconPath = this.column.isPrimaryKey
      ? new vscode.ThemeIcon("key", new vscode.ThemeColor("charts.yellow"))
      : new vscode.ThemeIcon("symbol-field", new vscode.ThemeColor("charts.blue"));
    return item;
  }
}

export class IndexNode extends DbTreeNode {
  constructor(private readonly index: IndexInfo) {
    super();
  }

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.index.name, vscode.TreeItemCollapsibleState.None);
    item.description = `${this.index.unique ? "UNIQUE " : ""}(${this.index.columns.join(", ")})`;
    item.iconPath = new vscode.ThemeIcon("list-ordered", new vscode.ThemeColor("charts.yellow"));
    return item;
  }
}

export class ForeignKeyNode extends DbTreeNode {
  constructor(private readonly fk: ForeignKeyInfo) {
    super();
  }

  toTreeItem(): vscode.TreeItem {
    const label = `${this.fk.source.columns.join(", ")} -> ${this.fk.target.table}(${this.fk.target.columns.join(", ")})`;
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon("references", new vscode.ThemeColor("charts.orange"));
    item.tooltip = this.fk.name;
    return item;
  }
}
