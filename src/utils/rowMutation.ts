/**
 * Builder thuần (không I/O) sinh câu SQL parameterized cho data edit và DDL cột.
 *
 * GIÁ TRỊ luôn đi qua placeholder của driver (chống SQL injection); chỉ tên
 * bảng/cột mới được nội suy trực tiếp và phải đi qua `quote`. Mỗi builder trả
 * về `{ sql, params }` để adapter bind theo `placeholderStyle`.
 */
import type { ObjectRef, ParamStatement, PlaceholderStyle } from "../core/types";

export type QuoteFn = (identifier: string) => string;

/** Một cặp cột/giá trị dùng cho insert/update/where. */
export interface ColumnValue {
  column: string;
  value: unknown;
}

/** Mô tả cột cho thao tác ADD COLUMN (DDL). */
export interface ColumnDefinition {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: string;
}

/** Sinh placeholder thứ `index` (1-based) theo dialect. */
export function placeholder(style: PlaceholderStyle, index: number): string {
  switch (style) {
    case "numbered":
      return `$${index}`;
    case "named":
      return `@p${index}`;
    case "qmark":
    default:
      return "?";
  }
}

function qualify(ref: ObjectRef, quote: QuoteFn): string {
  return ref.schema ? `${quote(ref.schema)}.${quote(ref.name)}` : quote(ref.name);
}

/** INSERT một dòng. Ném lỗi nếu không có cột nào. */
export function buildInsert(
  ref: ObjectRef,
  values: ColumnValue[],
  quote: QuoteFn,
  style: PlaceholderStyle
): ParamStatement {
  if (values.length === 0) {
    throw new Error("Insert requires at least one column value.");
  }
  const columns = values.map((value) => quote(value.column)).join(", ");
  const placeholders = values.map((_, index) => placeholder(style, index + 1)).join(", ");
  return {
    sql: `INSERT INTO ${qualify(ref, quote)} (${columns}) VALUES (${placeholders})`,
    params: values.map((value) => value.value)
  };
}

/**
 * UPDATE theo khóa. `set` là các cột cần đổi; `keys` là điều kiện WHERE (thường
 * là primary key). Ném lỗi nếu thiếu set hoặc keys (tránh update toàn bảng).
 */
export function buildUpdateByKey(
  ref: ObjectRef,
  set: ColumnValue[],
  keys: ColumnValue[],
  quote: QuoteFn,
  style: PlaceholderStyle
): ParamStatement {
  if (set.length === 0) {
    throw new Error("Update requires at least one column to change.");
  }
  if (keys.length === 0) {
    throw new Error("Update requires a key (primary key) to target a single row.");
  }
  let index = 0;
  const setClause = set
    .map((value) => `${quote(value.column)} = ${placeholder(style, ++index)}`)
    .join(", ");
  const whereClause = keys
    .map((key) => `${quote(key.column)} = ${placeholder(style, ++index)}`)
    .join(" AND ");
  return {
    sql: `UPDATE ${qualify(ref, quote)} SET ${setClause} WHERE ${whereClause}`,
    params: [...set.map((value) => value.value), ...keys.map((key) => key.value)]
  };
}

/** DELETE theo khóa. Ném lỗi nếu thiếu keys (tránh xóa toàn bảng). */
export function buildDeleteByKey(
  ref: ObjectRef,
  keys: ColumnValue[],
  quote: QuoteFn,
  style: PlaceholderStyle
): ParamStatement {
  if (keys.length === 0) {
    throw new Error("Delete requires a key (primary key) to target a single row.");
  }
  let index = 0;
  const whereClause = keys
    .map((key) => `${quote(key.column)} = ${placeholder(style, ++index)}`)
    .join(" AND ");
  return {
    sql: `DELETE FROM ${qualify(ref, quote)} WHERE ${whereClause}`,
    params: keys.map((key) => key.value)
  };
}

/**
 * ALTER TABLE ... ADD [COLUMN] (DDL, không có param). Default value được nội suy
 * trực tiếp nên người dùng phải xem preview trước khi chạy. SQL Server dùng
 * `ADD` (không có từ khóa `COLUMN`), các engine khác dùng `ADD COLUMN`.
 */
export function buildAddColumn(
  ref: ObjectRef,
  def: ColumnDefinition,
  quote: QuoteFn,
  keyword: "ADD COLUMN" | "ADD" = "ADD COLUMN"
): string {
  if (!def.name.trim()) {
    throw new Error("Column name is required.");
  }
  if (!def.dataType.trim()) {
    throw new Error("Column data type is required.");
  }
  const parts = [`${quote(def.name)} ${def.dataType.trim()}`];
  if (!def.nullable) {
    parts.push("NOT NULL");
  }
  if (def.defaultValue !== undefined && def.defaultValue !== "") {
    parts.push(`DEFAULT ${def.defaultValue}`);
  }
  return `ALTER TABLE ${qualify(ref, quote)} ${keyword} ${parts.join(" ")}`;
}

/** ALTER TABLE ... DROP COLUMN (DDL). */
export function buildDropColumn(ref: ObjectRef, column: string, quote: QuoteFn): string {
  if (!column.trim()) {
    throw new Error("Column name is required.");
  }
  return `ALTER TABLE ${qualify(ref, quote)} DROP COLUMN ${quote(column)}`;
}
