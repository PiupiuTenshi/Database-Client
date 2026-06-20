/** Một statement SQL kèm vị trí trong văn bản gốc. */
export interface SqlStatement {
  text: string;
  start: number;
  end: number;
}

/**
 * Tách SQL theo dấu `;`, có tôn trọng chuỗi '...' / "..." và comment (-- , block).
 * MVP đơn giản (docs/06 §3) — chưa xử lý dollar-quote của PostgreSQL.
 */
export function splitStatements(sql: string): SqlStatement[] {
  const statements: SqlStatement[] = [];
  let start = 0;
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inSingle) {
      if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === '"') inDouble = false;
      continue;
    }

    if (ch === "-" && next === "-") {
      inLineComment = true;
      i++;
    } else if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
    } else if (ch === "'") {
      inSingle = true;
    } else if (ch === '"') {
      inDouble = true;
    } else if (ch === ";") {
      pushStatement(statements, sql, start, i + 1);
      start = i + 1;
    }
  }
  pushStatement(statements, sql, start, sql.length);
  return statements;
}

/** Statement chứa vị trí offset (cho "Run Current Statement"). */
export function findStatementAt(sql: string, offset: number): SqlStatement | undefined {
  const statements = splitStatements(sql);
  return (
    statements.find((s) => offset >= s.start && offset <= s.end) ??
    statements[statements.length - 1]
  );
}

function pushStatement(out: SqlStatement[], sql: string, start: number, end: number): void {
  const text = sql.slice(start, end).trim();
  if (text.replace(/;+$/, "").trim().length > 0) {
    out.push({ text, start, end });
  }
}
