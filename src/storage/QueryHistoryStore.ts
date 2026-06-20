import type * as vscode from "vscode";
import type { QueryHistoryItem } from "../core/types";

const STORAGE_KEY = "openDbNexus.queryHistory";
const MAX_ITEMS = 200;

/**
 * Lưu lịch sử query trong globalState (mới nhất đứng đầu, giới hạn MAX_ITEMS).
 * docs/06 gợi ý JSONL file; bản này dùng Memento cho đơn giản và test được.
 */
export class QueryHistoryStore {
  constructor(private readonly memento: vscode.Memento) {}

  list(limit = MAX_ITEMS): QueryHistoryItem[] {
    return this.memento.get<QueryHistoryItem[]>(STORAGE_KEY, []).slice(0, limit);
  }

  async add(item: QueryHistoryItem): Promise<void> {
    const next = [item, ...this.memento.get<QueryHistoryItem[]>(STORAGE_KEY, [])].slice(
      0,
      MAX_ITEMS
    );
    await this.memento.update(STORAGE_KEY, next);
  }

  async clear(): Promise<void> {
    await this.memento.update(STORAGE_KEY, []);
  }
}
