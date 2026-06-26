import type * as vscode from "vscode";
import type { QueryHistoryItem } from "../core/types";

const STORAGE_KEY = "openDbNexus.queryHistory";
const DEFAULT_MAX_ITEMS = 200;

/**
 * Lưu lịch sử query trong globalState (mới nhất đứng đầu). Áp retention limit
 * cho mục thường nhưng KHÔNG bao giờ xóa mục favorite. Bản này dùng Memento
 * cho đơn giản và test được.
 */
export class QueryHistoryStore {
  constructor(
    private readonly memento: vscode.Memento,
    private readonly maxItems: () => number = () => DEFAULT_MAX_ITEMS
  ) {}

  private all(): QueryHistoryItem[] {
    return this.memento.get<QueryHistoryItem[]>(STORAGE_KEY, []);
  }

  list(limit?: number): QueryHistoryItem[] {
    const items = this.all();
    return limit === undefined ? items : items.slice(0, limit);
  }

  /** Lọc theo từ khóa (SQL/connection) và/hoặc chỉ favorite. */
  search(term?: string, favoritesOnly = false): QueryHistoryItem[] {
    const needle = term?.trim().toLowerCase();
    return this.all().filter((item) => {
      if (favoritesOnly && !item.favorite) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return (
        item.sql.toLowerCase().includes(needle) ||
        item.connectionName.toLowerCase().includes(needle)
      );
    });
  }

  async add(item: QueryHistoryItem): Promise<void> {
    const next = this.applyRetention([item, ...this.all()]);
    await this.memento.update(STORAGE_KEY, next);
  }

  /** Giữ tất cả favorite + các mục mới nhất tới retention limit. */
  private applyRetention(items: QueryHistoryItem[]): QueryHistoryItem[] {
    const max = Math.max(1, this.maxItems());
    if (items.length <= max) {
      return items;
    }
    const kept: QueryHistoryItem[] = [];
    let budget = max;
    for (const item of items) {
      if (item.favorite) {
        kept.push(item);
      } else if (budget > 0) {
        kept.push(item);
        budget -= 1;
      }
    }
    return kept;
  }

  async toggleFavorite(id: string): Promise<void> {
    const next = this.all().map((item) =>
      item.id === id ? { ...item, favorite: !item.favorite } : item
    );
    await this.memento.update(STORAGE_KEY, next);
  }

  async remove(id: string): Promise<void> {
    await this.memento.update(
      STORAGE_KEY,
      this.all().filter((item) => item.id !== id)
    );
  }

  async clearForConnection(connectionId: string): Promise<void> {
    await this.memento.update(
      STORAGE_KEY,
      this.all().filter((item) => item.connectionId !== connectionId)
    );
  }

  async clear(): Promise<void> {
    await this.memento.update(STORAGE_KEY, []);
  }
}
