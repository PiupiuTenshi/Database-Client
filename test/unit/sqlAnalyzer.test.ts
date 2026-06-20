import { describe, expect, it } from "vitest";
import { analyzeStatements } from "../../src/utils/sqlAnalyzer";

describe("analyzeStatements", () => {
  it("flags DROP / TRUNCATE", () => {
    expect(analyzeStatements(["DROP TABLE users"])).toHaveLength(1);
    expect(analyzeStatements(["TRUNCATE TABLE logs"])[0].reason).toMatch(/TRUNCATE/);
  });

  it("flags DELETE and UPDATE without WHERE", () => {
    expect(analyzeStatements(["DELETE FROM users"])).toHaveLength(1);
    expect(analyzeStatements(["UPDATE users SET active = 1"])).toHaveLength(1);
  });

  it("allows DELETE / UPDATE with a WHERE clause", () => {
    expect(analyzeStatements(["DELETE FROM users WHERE id = 1"])).toHaveLength(0);
    expect(analyzeStatements(["UPDATE users SET active = 1 WHERE id = 2"])).toHaveLength(0);
  });

  it("allows ordinary SELECT/INSERT", () => {
    expect(analyzeStatements(["SELECT * FROM users", "INSERT INTO t (a) VALUES (1)"])).toEqual([]);
  });

  it("ignores WHERE-like text inside comments and strings", () => {
    expect(analyzeStatements(["DELETE FROM users -- WHERE id = 1"])).toHaveLength(1);
    expect(analyzeStatements(["UPDATE t SET note = 'where to go' "])).toHaveLength(1);
  });

  it("collects multiple warnings across statements", () => {
    const warnings = analyzeStatements(["DROP TABLE a", "DELETE FROM b", "SELECT 1"]);
    expect(warnings).toHaveLength(2);
  });
});
