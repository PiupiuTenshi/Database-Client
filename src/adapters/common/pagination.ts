import type { ObjectRef } from "../../core/types";

/** Hàm bọc identifier theo dialect của adapter (double-quote / backtick / bracket). */
export type QuoteFn = (identifier: string) => string;

/**
 * Kiểu phân trang:
 * - limit-offset: `LIMIT n OFFSET m` (SQLite, Postgres, MySQL)
 * - offset-fetch: `OFFSET m ROWS FETCH NEXT n ROWS ONLY` (SQL Server, cần ORDER BY)
 */
export type PaginationStyle = "limit-offset" | "offset-fetch";

function qualify(ref: ObjectRef, quote: QuoteFn): string {
  return ref.schema ? `${quote(ref.schema)}.${quote(ref.name)}` : quote(ref.name);
}

/** Sinh câu SELECT * có phân trang cho table viewer. */
export function buildSelectAll(
  ref: ObjectRef,
  limit: number,
  offset: number,
  quote: QuoteFn,
  style: PaginationStyle = "limit-offset"
): string {
  const target = qualify(ref, quote);
  if (style === "offset-fetch") {
    // SQL Server bắt buộc ORDER BY khi dùng OFFSET/FETCH.
    return `SELECT * FROM ${target} ORDER BY (SELECT NULL) OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
  }
  return `SELECT * FROM ${target} LIMIT ${limit} OFFSET ${offset}`;
}

/** Sinh câu đếm tổng số dòng. */
export function buildCount(ref: ObjectRef, quote: QuoteFn): string {
  return `SELECT COUNT(*) AS count FROM ${qualify(ref, quote)}`;
}
