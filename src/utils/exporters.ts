/**
 * Exporter thuần (không I/O) cho result grid / table data: CSV, JSON, SQL Insert.
 * Không thêm dependency runtime — XLSX nằm trong backlog để tránh bundle nặng.
 */
import type { ObjectRef } from "../core/types";

export type ExportFormat = "csv" | "json" | "sql";

export type QuoteFn = (identifier: string) => string;

type Row = Record<string, unknown>;

/** Chuẩn hóa một giá trị thành text cho CSV/preview. */
function toText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  switch (typeof value) {
    case "string":
      return value;
    case "number":
    case "bigint":
    case "boolean":
      return String(value);
    default:
      return JSON.stringify(value) ?? "";
  }
}

/** Escape một field CSV (RFC 4180): bọc nháy kép nếu chứa , " hoặc xuống dòng. */
function csvField(value: unknown): string {
  const text = toText(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(columns: string[], rows: Row[]): string {
  const header = columns.map(csvField).join(",");
  const body = rows.map((row) => columns.map((column) => csvField(row[column])).join(","));
  return [header, ...body].join("\r\n");
}

export function toJson(rows: Row[]): string {
  return JSON.stringify(rows, null, 2);
}

/** Nội suy một literal an toàn cho SQL Insert (export tĩnh, không dùng để thực thi động). */
function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  const text = typeof value === "object" ? JSON.stringify(value) : (value as string);
  return `'${text.replace(/'/g, "''")}'`;
}

export function toSqlInsert(
  ref: ObjectRef,
  columns: string[],
  rows: Row[],
  quote: QuoteFn
): string {
  if (columns.length === 0) {
    return "";
  }
  const target = ref.schema ? `${quote(ref.schema)}.${quote(ref.name)}` : quote(ref.name);
  const cols = columns.map(quote).join(", ");
  return rows
    .map((row) => {
      const values = columns.map((column) => sqlLiteral(row[column])).join(", ");
      return `INSERT INTO ${target} (${cols}) VALUES (${values});`;
    })
    .join("\n");
}

/** Build nội dung export theo format đã chọn. */
export function buildExport(
  format: ExportFormat,
  ref: ObjectRef,
  columns: string[],
  rows: Row[],
  quote: QuoteFn
): string {
  switch (format) {
    case "csv":
      return toCsv(columns, rows);
    case "json":
      return toJson(rows);
    case "sql":
      return toSqlInsert(ref, columns, rows, quote);
  }
}

/** Đuôi file mặc định cho format. */
export function extensionFor(format: ExportFormat): string {
  return format === "sql" ? "sql" : format;
}
