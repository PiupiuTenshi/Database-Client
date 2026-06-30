import * as vscode from "vscode";
import { CONTEXT_VALUES } from "../../../core/constants";
import type { ConnectionProfile } from "../../../core/types";
import { DbTreeNode, type TreeContext } from "./DbTreeNode";
import { SchemaNode, TablesFolderNode, ViewsFolderNode } from "./folderNodes";
import { InfoNode } from "./InfoNode";
import { safeChildren } from "./treeHelpers";

/** Node gốc đại diện cho một connection profile. */
export class ConnectionNode extends DbTreeNode {
  constructor(
    public readonly profile: ConnectionProfile,
    private readonly version?: string
  ) {
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

  cacheKey(): string {
    return `connection:${this.profile.id}`;
  }

  private describe(): string {
    const parts: string[] = [this.profile.dbType];
    if (this.version) {
      parts.push(this.version);
    }
    if (this.profile.environment !== "local") {
      parts.push(this.profile.environment);
    }
    return parts.join(" | ");
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
    if (this.version) {
      lines.push(`Version: ${this.version}`);
    }
    lines.push(`Environment: ${this.profile.environment}`);
    if (this.profile.tags.length > 0) {
      lines.push(`Tags: ${this.profile.tags.join(", ")}`);
    }
    return lines.join("\n");
  }

  getChildren(context: TreeContext): Promise<DbTreeNode[]> {
    if (!context.sessionManager.supports(this.profile)) {
      return Promise.resolve([
        new InfoNode(`Adapter for ${this.profile.dbType} arrives in a later phase`)
      ]);
    }
    return safeChildren(async () => {
      const schemas = await context.schemaService.listSchemas(this.profile);
      // Engine không có lớp schema (SQLite) -> hiện Tables/Views trực tiếp.
      if (schemas.length === 0) {
        return [new TablesFolderNode(this.profile), new ViewsFolderNode(this.profile)];
      }
      return schemas.map((schema) => new SchemaNode(this.profile, schema.name));
    });
  }
}
