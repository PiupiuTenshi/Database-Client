import * as vscode from "vscode";
import type { SchemaService } from "../../../services/SchemaService";
import type { SessionManager } from "../../../services/SessionManager";

/** Dependencies truyền xuống node khi lazy-load con. */
export interface TreeContext {
  schemaService: SchemaService;
  sessionManager: SessionManager;
}

/**
 * Base cho mọi node trong Database Explorer. Mỗi node tự biết cách render thành
 * vscode.TreeItem và (nếu có) cách lazy-load node con.
 */
export abstract class DbTreeNode {
  abstract toTreeItem(): vscode.TreeItem;

  cacheKey(): string | undefined {
    return undefined;
  }

  getChildren(_context: TreeContext): DbTreeNode[] | Promise<DbTreeNode[]> {
    return [];
  }
}
