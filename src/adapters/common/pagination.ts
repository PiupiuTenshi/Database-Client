import type { ObjectRef } from "../../core/types";
import { qualify } from "../../utils/sqlSafety";

/** Sinh câu SELECT * có phân trang (LIMIT/OFFSET) cho table viewer. */
export function buildSelectAll(ref: ObjectRef, limit: number, offset: number): string {
  return `SELECT * FROM ${qualify(ref.schema, ref.name)} LIMIT ${limit} OFFSET ${offset}`;
}

/** Sinh câu đếm tổng số dòng. */
export function buildCount(ref: ObjectRef): string {
  return `SELECT COUNT(*) AS count FROM ${qualify(ref.schema, ref.name)}`;
}
