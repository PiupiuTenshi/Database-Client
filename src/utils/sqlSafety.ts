/**
 * Trợ giúp nội suy identifier an toàn vào SQL. GIÁ TRỊ luôn truyền qua
 * placeholder của driver; chỉ identifier (tên bảng/cột) mới dùng các hàm này.
 */

/** Bọc identifier trong dấu nháy kép kiểu SQL chuẩn, escape `"` -> `""`. */
export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Bọc identifier trong backtick (MySQL/MariaDB), escape `` ` `` -> ``` `` ```. */
export function quoteBacktick(name: string): string {
  return `\`${name.replace(/`/g, "``")}\``;
}

/** Bọc identifier trong ngoặc vuông (SQL Server), escape `]` -> `]]`. */
export function quoteBracket(name: string): string {
  return `[${name.replace(/]/g, "]]")}]`;
}

/** Bọc chuỗi thành string literal (dùng cho PRAGMA không nhận placeholder). */
export function quoteStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Tên đầy đủ schema.table (nếu có schema). */
export function qualify(schema: string | undefined, name: string): string {
  return schema ? `${quoteIdentifier(schema)}.${quoteIdentifier(name)}` : quoteIdentifier(name);
}
