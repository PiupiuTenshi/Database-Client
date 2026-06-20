import { describe, expect, it } from "vitest";
import { findStatementAt, splitStatements } from "../../src/utils/statementSplitter";

describe("splitStatements", () => {
  it("splits on semicolons", () => {
    const result = splitStatements("SELECT 1; SELECT 2;");
    expect(result.map((s) => s.text)).toEqual(["SELECT 1;", "SELECT 2;"]);
  });

  it("ignores semicolons inside string literals", () => {
    const result = splitStatements("SELECT ';not a split'; SELECT 2");
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("SELECT ';not a split';");
  });

  it("ignores semicolons inside line and block comments", () => {
    const result = splitStatements("SELECT 1; -- a; b\nSELECT 2; /* c; d */ SELECT 3");
    // Semicolons in comments must not create extra splits.
    expect(result).toHaveLength(3);
    expect(result[1].text).toContain("SELECT 2");
    expect(result[2].text).toContain("SELECT 3");
  });

  it("drops empty/whitespace-only statements", () => {
    expect(splitStatements("  ;; \n ;")).toEqual([]);
  });
});

describe("findStatementAt", () => {
  it("returns the statement containing the offset", () => {
    const sql = "SELECT 1;\nSELECT 2;";
    const offset = sql.indexOf("SELECT 2");
    expect(findStatementAt(sql, offset)?.text).toBe("SELECT 2;");
  });

  it("falls back to the last statement", () => {
    const sql = "SELECT 1;\nSELECT 2";
    expect(findStatementAt(sql, sql.length)?.text).toBe("SELECT 2");
  });
});
