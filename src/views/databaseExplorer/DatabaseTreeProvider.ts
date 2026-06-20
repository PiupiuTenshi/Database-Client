import * as vscode from "vscode";
import type { ConnectionService } from "../../services/ConnectionService";
import { ConnectionNode } from "./nodes/ConnectionNode";
import { DbTreeNode } from "./nodes/DbTreeNode";

/** TreeDataProvider cho view "Connections". */
export class DatabaseTreeProvider
  implements vscode.TreeDataProvider<DbTreeNode>, vscode.Disposable
{
  private readonly changeEmitter = new vscode.EventEmitter<DbTreeNode | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<DbTreeNode | undefined | void> =
    this.changeEmitter.event;

  constructor(private readonly connectionService: ConnectionService) {}

  /** Refresh toàn bộ cây (node = undefined) hoặc chỉ một nhánh. */
  refresh(node?: DbTreeNode): void {
    this.changeEmitter.fire(node);
  }

  getTreeItem(element: DbTreeNode): vscode.TreeItem {
    return element.toTreeItem();
  }

  async getChildren(element?: DbTreeNode): Promise<DbTreeNode[]> {
    if (!element) {
      return this.connectionService.listProfiles().map((profile) => new ConnectionNode(profile));
    }
    return element.getChildren({ connectionService: this.connectionService });
  }

  dispose(): void {
    this.changeEmitter.dispose();
  }
}
