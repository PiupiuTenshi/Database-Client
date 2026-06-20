import type { ObjectRef } from "../../core/types";

/** Hàm bọc identifier theo dialect của adapter (double-quote / backtick). */
export type QuoteFn = (identifier: string) => string;

function qualify(ref: ObjectRef, quote: QuoteFn): string {
  return ref.schema ? `${quote(ref.schema)}.${quote(ref.name)}` : quote(ref.name);
}

/** Sinh câu SELECT * có phân trang (LIMIT/OFFSET) cho table viewer. */
export function buildSelectAll(
  ref: ObjectRef,
  limit: number,
  offset: number,
  quote: QuoteFn
): string {
  return `SELECT * FROM ${qualify(ref, quote)} LIMIT ${limit} OFFSET ${offset}`;
}

/** Sinh câu đếm tổng số dòng. */
export function buildCount(ref: ObjectRef, quote: QuoteFn): string {
  return `SELECT COUNT(*) AS count FROM ${qualify(ref, quote)}`;
}
