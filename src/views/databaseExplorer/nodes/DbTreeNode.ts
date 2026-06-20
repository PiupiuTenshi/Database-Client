import * as vscode from "vscode";
import type { ConnectionService } from "../../../services/ConnectionService";

/** Dependencies truyền xuống node khi lazy-load con. Sẽ mở rộng ở các phase sau. */
export interface TreeContext {
  connectionService: ConnectionService;
}

/**
 * Base cho mọi node trong Database Explorer. Mỗi node tự biết cách render thành
 * vscode.TreeItem và (nếu có) cách lấy node con.
 */
export abstract class DbTreeNode {
  abstract toTreeItem(): vscode.TreeItem;

  getChildren(_context: TreeContext): DbTreeNode[] | Promise<DbTreeNode[]> {
    return [];
  }
}
