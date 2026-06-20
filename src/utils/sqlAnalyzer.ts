/**
 * Phát hiện câu SQL nguy hiểm để cảnh báo trước khi chạy (docs/06 §10).
 * Heuristic dựa trên từ khóa — không phải parser đầy đủ; mục tiêu là chặn các
 * thao tác phá hủy phổ biến (DROP/TRUNCATE/DELETE|UPDATE thiếu WHERE).
 */
export interface SqlWarning {
  statement: string;
  reason: string;
}

/** Bỏ comment dòng, comment block và string literal để dò từ khóa an toàn hơn. */
function stripNoise(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""')
    .replace(/\s+/g, " ")
    .trim();
}

/** Phân tích một statement đã làm sạch; trả lý do nguy hiểm hoặc undefined. */
function analyzeOne(cleaned: string): string | undefined {
  const upper = cleaned.toUpperCase();
  if (/^\s*DROP\s+(TABLE|DATABASE|SCHEMA|VIEW|INDEX)/.test(upper)) {
    return "DROP statement permanently removes a database object.";
  }
  if (/^\s*TRUNCATE\b/.test(upper)) {
    return "TRUNCATE removes all rows from the table.";
  }
  if (/^\s*DELETE\s+FROM\b/.test(upper) && !/\bWHERE\b/.test(upper)) {
    return "DELETE without a WHERE clause removes every row.";
  }
  if (/^\s*UPDATE\b/.test(upper) && !/\bWHERE\b/.test(upper)) {
    return "UPDATE without a WHERE clause changes every row.";
  }
  return undefined;
}

/** Phân tích danh sách statement; trả về các cảnh báo (rỗng nếu an toàn). */
export function analyzeStatements(statements: string[]): SqlWarning[] {
  const warnings: SqlWarning[] = [];
  for (const statement of statements) {
    const cleaned = stripNoise(statement);
    if (!cleaned) {
      continue;
    }
    const reason = analyzeOne(cleaned);
    if (reason) {
      warnings.push({ statement: statement.trim().replace(/\s+/g, " ").slice(0, 120), reason });
    }
  }
  return warnings;
}
