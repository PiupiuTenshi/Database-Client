import { buildCount, buildSelectAll } from "../adapters/common/pagination";
import type { ConnectionProfile, ObjectRef, QueryOptions, QueryResult } from "../core/types";
import type { SessionManager } from "./SessionManager";

export interface TablePage {
  result: QueryResult;
  total: number;
  offset: number;
  limit: number;
}

/** Chạy query qua adapter của connection. */
export class QueryService {
  constructor(private readonly sessionManager: SessionManager) {}

  async execute(
    profile: ConnectionProfile,
    sql: string,
    options?: QueryOptions
  ): Promise<QueryResult> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    return withStatement(await adapter.executeQuery(session, sql, options), sql, options?.params);
  }

  /** Lấy một trang dữ liệu bảng (table viewer). */
  async getTablePage(
    profile: ConnectionProfile,
    ref: ObjectRef,
    limit: number,
    offset: number
  ): Promise<TablePage> {
    const { adapter, session } = await this.sessionManager.getOrConnect(profile);
    const quote = (id: string): string => adapter.quoteIdentifier(id);
    const pageSql = buildSelectAll(ref, limit, offset, quote, adapter.paginationStyle);
    const countSql = buildCount(ref, quote);
    const result = await adapter.executeQuery(session, pageSql);
    const countResult = await adapter.executeQuery(session, countSql);
    const total = Number((countResult.rows[0]?.count as number | undefined) ?? 0);
    return {
      result: withStatement(result, pageSql),
      total,
      offset,
      limit
    };
  }
}

function withStatement(result: QueryResult, sql: string, params?: unknown[]): QueryResult {
  return { ...result, sql, params };
}
