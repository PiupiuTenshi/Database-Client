import * as vscode from "vscode";
import { CONTEXT_VALUES } from "../../../core/constants";
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
    item.description = this.describe();
    item.tooltip = this.buildTooltip();
    item.iconPath = new vscode.ThemeIcon(
      this.profile.environment === "production" ? "warning" : "database"
    );
    return item;
  }

  private describe(): string {
    const parts: string[] = [this.profile.dbType];
    if (this.profile.environment !== "local") {
      parts.push(this.profile.environment);
    }
    return parts.join(" · ");
  }

  private buildTooltip(): string {
    const lines = [`${this.profile.name} (${this.profile.dbType})`];
    if (this.profile.filePath) {
      lines.push(`File: ${this.profile.filePath}`);
    }
    if (this.profile.host) {
      lines.push(`Host: ${this.profile.host}${this.profile.port ? `:${this.profile.port}` : ""}`);
    }
    if (this.profile.database) {
      lines.push(`Database: ${this.profile.database}`);
    }
    lines.push(`Environment: ${this.profile.environment}`);
    if (this.profile.tags.length > 0) {
      lines.push(`Tags: ${this.profile.tags.join(", ")}`);
    }
    return lines.join("\n");
  }

  getChildren(): DbTreeNode[] {
    // Phase 2: chưa connect DB thật, hiển thị placeholder cho tới Phase 3 (adapter).
    return [new InfoNode("Connect & schema explorer arrive with the database adapters")];
  }
}
