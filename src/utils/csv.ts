/**
 * Parser CSV tối giản theo RFC 4180 (hỗ trợ field có dấu nháy kép, dấu phẩy và
 * xuống dòng bên trong field). Không thêm dependency. Dòng đầu là header.
 */
export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export function parseCsv(text: string): ParsedCsv {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  // Bỏ BOM nếu có.
  if (text.charCodeAt(0) === 0xfeff) {
    i = 1;
  }
  const pushField = (): void => {
    record.push(field);
    field = "";
  };
  const pushRecord = (): void => {
    pushField();
    records.push(record);
    record = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      pushField();
      i += 1;
    } else if (ch === "\r") {
      // CRLF hoặc CR đơn -> kết thúc record.
      pushRecord();
      i += text[i + 1] === "\n" ? 2 : 1;
    } else if (ch === "\n") {
      pushRecord();
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  // Field/record cuối nếu file không kết thúc bằng newline.
  if (field.length > 0 || record.length > 0) {
    pushRecord();
  }
  // Bỏ các record rỗng ở cuối (do trailing newline).
  const nonEmpty = records.filter((rec) => !(rec.length === 1 && rec[0] === ""));
  const [headers, ...rows] = nonEmpty;
  return { headers: headers ?? [], rows };
}
