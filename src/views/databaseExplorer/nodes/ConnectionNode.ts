import * as vscode from "vscode";
import { CONTEXT_VALUES } from "../../../core/constants";
import { SCHEMA_PENDING_LABEL } from "../../../core/messages";
import type { ConnectionProfile } from "../../../core/types";
import { DbTreeNode } from "./DbTreeNode";
import { InfoNode } from "./InfoNode";

/** Node gốc đại diện cho một connection profile. */
export class ConnectionNode extends DbTreeNode {
  constructor(public readonly profile: ConnectionProfile) {
    super();
  }

  toTreeItem(): vscode.TreeItem {
    const item = new vscode.TreeItem(this.profile.name, vscode.TreeItemCollapsibleState.Collapsed);
    item.id = this.profile.id;
    item.contextValue = CONTEXT_VALUES.connection;
    item.description = this.profile.driver;
    item.tooltip = `${this.profile.name} (${this.profile.driver})`;
    item.iconPath = new vscode.ThemeIcon("database");
    return item;
  }

  getChildren(): DbTreeNode[] {
    // Phase 1: chưa connect DB thật, hiển thị placeholder.
    return [new InfoNode(SCHEMA_PENDING_LABEL)];
  }
}
