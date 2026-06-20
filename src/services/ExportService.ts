import type { ConnectionProfile, ObjectRef } from "../core/types";
import type { QueryService } from "./QueryService";
import type { SessionManager } from "./SessionManager";

export interface FetchedRows {
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
}

/** Trần an toàn khi export toàn bảng để tránh nạp quá nhiều vào bộ nhớ. */
const EXPORT_ROW_CAP = 50_000;
const PAGE = 1_000;

/** Thu thập dữ liệu để export (một trang hoặc toàn bộ bảng, có trần). */
export class ExportService {
  constructor(
    private readonly queryService: QueryService,
    private readonly sessionManager: SessionManager
  ) {}

  /** Hàm bọc identifier theo dialect của connection (cho SQL Insert export). */
  async quoteFn(profile: ConnectionProfile): Promise<(id: string) => string> {
    const { adapter } = await this.sessionManager.getOrConnect(profile);
    return (id: string) => adapter.quoteIdentifier(id);
  }

  async fetchPage(
    profile: ConnectionProfile,
    ref: ObjectRef,
    pageSize: number,
    offset: number
  ): Promise<FetchedRows> {
    const page = await this.queryService.getTablePage(profile, ref, pageSize, offset);
    return {
      columns: page.result.columns.map((column) => column.name),
      rows: page.result.rows,
      truncated: false
    };
  }

  /** Page qua toàn bảng tới EXPORT_ROW_CAP; đánh dấu truncated nếu vượt trần. */
  async fetchAll(profile: ConnectionProfile, ref: ObjectRef): Promise<FetchedRows> {
    const rows: Record<string, unknown>[] = [];
    let columns: string[] = [];
    let offset = 0;
    let truncated = false;
    for (;;) {
      const page = await this.queryService.getTablePage(profile, ref, PAGE, offset);
      if (columns.length === 0) {
        columns = page.result.columns.map((column) => column.name);
      }
      rows.push(...page.result.rows);
      if (rows.length >= EXPORT_ROW_CAP) {
        rows.length = EXPORT_ROW_CAP;
        truncated = true;
        break;
      }
      if (offset + PAGE >= page.total || page.result.rows.length === 0) {
        break;
      }
      offset += PAGE;
    }
    return { columns, rows, truncated };
  }
}
