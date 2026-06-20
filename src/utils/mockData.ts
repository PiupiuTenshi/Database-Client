/**
 * Sinh dữ liệu giả (mock) theo kiểu cột, có seed để tái lập. Thuần, không I/O.
 * Giá trị trả về là string|number|boolean|null để bind qua placeholder của driver.
 */
import type { ColumnValue } from "./rowMutation";

export type GenKind =
  | "int"
  | "decimal"
  | "boolean"
  | "date"
  | "datetime"
  | "uuid"
  | "email"
  | "name"
  | "text"
  | "json";

export interface MockColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

export interface MockOptions {
  count: number;
  seed?: number;
  /** Tỉ lệ NULL (0..1) cho cột nullable. */
  nullRatio?: number;
}

/** PRNG mulberry32 — deterministic theo seed (không dùng Math.random). */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST_NAMES = ["Ann", "Bob", "Chi", "Dao", "Evan", "Fang", "Gia", "Huy", "Iris", "Jack"];
const LAST_NAMES = ["Tran", "Nguyen", "Le", "Pham", "Vo", "Smith", "Jones", "Kim", "Singh", "Lo"];
const WORDS = ["lorem", "ipsum", "dolor", "sit", "amet", "data", "alpha", "beta", "gamma", "node"];

/** Suy ra GenKind từ dataType (và gợi ý theo tên cột cho email/name). */
export function inferKind(dataType: string, columnName = ""): GenKind {
  const t = dataType.toLowerCase();
  const n = columnName.toLowerCase();
  if (/uuid|uniqueidentifier/.test(t)) return "uuid";
  if (/(^|_)(int|serial|bigint|smallint|tinyint)/.test(t) || /\bint\b/.test(t)) return "int";
  if (/decimal|numeric|float|double|real|money/.test(t)) return "decimal";
  if (/bool|bit/.test(t)) return "boolean";
  if (/timestamp|datetime/.test(t)) return "datetime";
  if (/date/.test(t)) return "date";
  if (/json/.test(t)) return "json";
  if (n.includes("email")) return "email";
  if (n.includes("name")) return "name";
  return "text";
}

function pick<T>(rng: () => number, list: T[]): T {
  return list[Math.floor(rng() * list.length)];
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Sinh một giá trị theo kind. `seq` giúp giá trị duy nhất hơn (vd email, uuid). */
export function generateValue(kind: GenKind, rng: () => number, seq: number): unknown {
  switch (kind) {
    case "int":
      return Math.floor(rng() * 100000);
    case "decimal":
      return Math.round(rng() * 100000) / 100;
    case "boolean":
      return rng() < 0.5;
    case "date": {
      const year = 2018 + Math.floor(rng() * 8);
      return `${year}-${pad(1 + Math.floor(rng() * 12))}-${pad(1 + Math.floor(rng() * 28))}`;
    }
    case "datetime": {
      const year = 2018 + Math.floor(rng() * 8);
      const date = `${year}-${pad(1 + Math.floor(rng() * 12))}-${pad(1 + Math.floor(rng() * 28))}`;
      return `${date} ${pad(Math.floor(rng() * 24))}:${pad(Math.floor(rng() * 60))}:${pad(Math.floor(rng() * 60))}`;
    }
    case "uuid": {
      const hex = "0123456789abcdef";
      let out = "";
      for (let i = 0; i < 32; i++) {
        out += hex[Math.floor(rng() * 16)];
        if (i === 7 || i === 11 || i === 15 || i === 19) out += "-";
      }
      return out;
    }
    case "email":
      return `${pick(rng, FIRST_NAMES).toLowerCase()}${seq}@example.com`;
    case "name":
      return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
    case "json":
      return JSON.stringify({ id: seq, value: pick(rng, WORDS) });
    case "text":
    default:
      return `${pick(rng, WORDS)} ${pick(rng, WORDS)} ${seq}`;
  }
}

/**
 * Sinh `count` dòng cho danh sách cột. Bỏ qua cột PK kiểu integer (coi như
 * auto-increment). Cột nullable có thể nhận NULL theo nullRatio.
 */
export function generateRows(columns: MockColumn[], options: MockOptions): ColumnValue[][] {
  const rng = makeRng(options.seed ?? 1);
  const nullRatio = options.nullRatio ?? 0;
  const targets = columns.filter((column) => {
    const kind = inferKind(column.dataType, column.name);
    return !(column.isPrimaryKey && kind === "int");
  });
  const rows: ColumnValue[][] = [];
  for (let r = 0; r < options.count; r++) {
    const row: ColumnValue[] = targets.map((column) => {
      if (column.nullable && rng() < nullRatio) {
        return { column: column.name, value: null };
      }
      const kind = inferKind(column.dataType, column.name);
      return { column: column.name, value: generateValue(kind, rng, r + 1) };
    });
    rows.push(row);
  }
  return rows;
}
