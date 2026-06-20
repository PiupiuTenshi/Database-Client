import { describe, expect, it } from "vitest";
import { buildExport, toCsv, toJson, toSqlInsert } from "../../src/utils/exporters";

const q = (id: string): string => `"${id}"`;
const ref = { name: "users", schema: "public" };
const columns = ["id", "name", "note"];
const rows = [
  { id: 1, name: "Ann", note: null },
  { id: 2, name: 'B,o"b', note: "x\ny" }
];

describe("toCsv", () => {
  it("escapes commas, quotes and newlines per RFC 4180", () => {
    const csv = toCsv(columns, rows);
    expect(csv).toBe('id,name,note\r\n1,Ann,\r\n2,"B,o""b","x\ny"');
  });
});

describe("toJson", () => {
  it("serializes rows as pretty JSON", () => {
    expect(JSON.parse(toJson(rows))).toEqual(rows);
  });
});

describe("toSqlInsert", () => {
  it("builds INSERT statements with quoted identifiers and escaped literals", () => {
    const sql = toSqlInsert(ref, columns, rows, q);
    expect(sql).toContain('INSERT INTO "public"."users" ("id", "name", "note")');
    expect(sql).toContain("VALUES (1, 'Ann', NULL);");
    expect(sql).toContain("'B,o\"b'");
  });

  it("returns empty string with no columns", () => {
    expect(toSqlInsert(ref, [], rows, q)).toBe("");
  });
});

describe("buildExport", () => {
  it("dispatches by format", () => {
    expect(buildExport("csv", ref, columns, rows, q)).toBe(toCsv(columns, rows));
    expect(buildExport("json", ref, columns, rows, q)).toBe(toJson(rows));
    expect(buildExport("sql", ref, columns, rows, q)).toBe(toSqlInsert(ref, columns, rows, q));
  });
});
