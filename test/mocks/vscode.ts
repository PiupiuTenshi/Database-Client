/**
 * Mock tối thiểu cho module "vscode" khi chạy Vitest (node environment).
 * Chỉ implement những API mà unit test thực sự dùng. tsc vẫn type-check code
 * thật bằng @types/vscode; mock này chỉ thay thế lúc runtime của test.
 */

export interface Disposable {
  dispose(): void;
}

export class EventEmitter<T> {
  private listeners = new Set<(value: T) => void>();

  readonly event = (listener: (value: T) => void): Disposable => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };

  fire(value: T): void {
    for (const listener of this.listeners) {
      listener(value);
    }
  }

  dispose(): void {
    this.listeners.clear();
  }
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2
}

export class ThemeIcon {
  constructor(readonly id: string) {}
}

export class TreeItem {
  id?: string;
  contextValue?: string;
  description?: string;
  tooltip?: string;
  iconPath?: ThemeIcon;

  constructor(
    readonly label: string,
    readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None
  ) {}
}

export const workspace = {
  getConfiguration: () => ({
    get: <T>(_key: string, defaultValue: T): T => defaultValue
  })
};
