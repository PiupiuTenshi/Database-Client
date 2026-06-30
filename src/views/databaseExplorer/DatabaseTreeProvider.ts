import * as vscode from "vscode";
import type { ConnectionService } from "../../services/ConnectionService";
import type { DashboardService } from "../../services/DashboardService";
import type { SchemaService } from "../../services/SchemaService";
import type { SessionManager } from "../../services/SessionManager";
import { withTimeout } from "../../utils/asyncTimeout";
import { ConnectionNode } from "./nodes/ConnectionNode";
import { DbTreeNode } from "./nodes/DbTreeNode";
import { ErrorNode } from "./nodes/ErrorNode";
import { InfoNode } from "./nodes/InfoNode";

interface ChildCacheEntry {
  children: DbTreeNode[];
}

const DEFAULT_TREE_LOAD_TIMEOUT_SECONDS = 15;

/** TreeDataProvider cho view "Connections". */
export class DatabaseTreeProvider
  implements vscode.TreeDataProvider<DbTreeNode>, vscode.Disposable
{
  private readonly changeEmitter = new vscode.EventEmitter<DbTreeNode | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<DbTreeNode | undefined | void> =
    this.changeEmitter.event;
  private readonly childCache = new Map<string, ChildCacheEntry>();
  private disposed = false;

  constructor(
    private readonly connectionService: ConnectionService,
    private readonly schemaService: SchemaService,
    private readonly sessionManager: SessionManager,
    private readonly dashboardService: DashboardService
  ) {}

  private readonly versionCache = new Map<string, string | undefined>();
  private readonly loadingVersions = new Set<string>();

  /** Refresh toàn bộ cây (node = undefined) hoặc chỉ một nhánh. */
  refresh(node?: DbTreeNode): void {
    const key = node?.cacheKey();
    if (key) {
      this.childCache.delete(key);
    } else {
      this.childCache.clear();
    }
    this.changeEmitter.fire(node);
  }

  clearMetadataCache(): void {
    this.versionCache.clear();
    this.loadingVersions.clear();
    this.childCache.clear();
  }

  getTreeItem(element: DbTreeNode): vscode.TreeItem {
    return element.toTreeItem();
  }

  getChildren(element?: DbTreeNode): DbTreeNode[] | Promise<DbTreeNode[]> {
    if (!element) {
      const profiles = this.connectionService.listProfiles();
      profiles.forEach((profile) => this.loadVersion(profile));
      return profiles.map(
        (profile) => new ConnectionNode(profile, this.versionCache.get(profile.id))
      );
    }
    const key = element.cacheKey();
    if (!key) {
      return element.getChildren(this.treeContext());
    }

    const cached = this.childCache.get(key);
    if (cached) {
      return cached.children;
    }

    this.childCache.set(key, { children: [new InfoNode("Loading…")] });
    void this.loadChildrenInBackground(element, key);
    return [new InfoNode("Loading…")];
  }

  dispose(): void {
    this.disposed = true;
    this.childCache.clear();
    this.changeEmitter.dispose();
  }

  private async loadChildrenInBackground(element: DbTreeNode, key: string): Promise<void> {
    let children: DbTreeNode[];
    try {
      children = await withTimeout(
        Promise.resolve(element.getChildren(this.treeContext())),
        this.loadTimeoutMs(),
        `Database metadata load timed out after ${this.loadTimeoutSeconds()}s. Check host/port/network or refresh to retry.`
      );
    } catch (error) {
      children = [new ErrorNode(error instanceof Error ? error.message : String(error))];
    }
    this.childCache.set(key, { children });
    if (!this.disposed) {
      this.changeEmitter.fire(element);
    }
  }

  private treeContext() {
    return {
      schemaService: this.schemaService,
      sessionManager: this.sessionManager
    };
  }

  private loadTimeoutMs(): number {
    return this.loadTimeoutSeconds() * 1000;
  }

  private loadTimeoutSeconds(): number {
    return Math.max(
      1,
      vscode.workspace
        .getConfiguration("openDbNexus")
        .get<number>("metadata.loadTimeoutSeconds", DEFAULT_TREE_LOAD_TIMEOUT_SECONDS)
    );
  }

  private loadVersion(profile: ConnectionNode["profile"]): void {
    if (
      this.versionCache.has(profile.id) ||
      this.loadingVersions.has(profile.id) ||
      !this.sessionManager.supports(profile)
    ) {
      return;
    }
    this.loadingVersions.add(profile.id);
    void this.dashboardService
      .getVersion(profile)
      .then((version) => {
        this.versionCache.set(profile.id, version);
      })
      .catch(() => {
        this.versionCache.set(profile.id, undefined);
      })
      .finally(() => {
        this.loadingVersions.delete(profile.id);
        if (!this.disposed) {
          this.changeEmitter.fire(undefined);
        }
      });
  }
}
