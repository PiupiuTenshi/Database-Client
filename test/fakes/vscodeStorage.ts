import type * as vscode from "vscode";

/** Memento giả (in-memory) cho test ProfileStore/ConnectionService. */
export class FakeMemento implements vscode.Memento {
  private readonly store = new Map<string, unknown>();

  keys(): readonly string[] {
    return [...this.store.keys()];
  }

  get<T>(key: string, defaultValue?: T): T | undefined {
    return (this.store.has(key) ? this.store.get(key) : defaultValue) as T | undefined;
  }

  update(key: string, value: unknown): Thenable<void> {
    if (value === undefined) {
      this.store.delete(key);
    } else {
      this.store.set(key, value);
    }
    return Promise.resolve();
  }
}

/** SecretStorage giả (in-memory) cho test SecretStore/ConnectionService. */
export class FakeSecretStorage implements vscode.SecretStorage {
  private readonly data = new Map<string, string>();

  // Không dùng trong test nên trả về Disposable rỗng.
  readonly onDidChange = (() => ({
    dispose() {
      /* noop */
    }
  })) as unknown as vscode.Event<vscode.SecretStorageChangeEvent>;

  get(key: string): Thenable<string | undefined> {
    return Promise.resolve(this.data.get(key));
  }

  store(key: string, value: string): Thenable<void> {
    this.data.set(key, value);
    return Promise.resolve();
  }

  delete(key: string): Thenable<void> {
    this.data.delete(key);
    return Promise.resolve();
  }

  keys(): Thenable<string[]> {
    return Promise.resolve([...this.data.keys()]);
  }

  /** Helper test-only. */
  has(key: string): boolean {
    return this.data.has(key);
  }
}
