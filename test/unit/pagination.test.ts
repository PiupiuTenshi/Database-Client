import { describe, expect, it } from "vitest";
import { buildCount, buildSelectAll } from "../../src/adapters/common/pagination";
import { quoteBacktick, quoteBracket, quoteIdentifier } from "../../src/utils/sqlSafety";

describe("pagination", () => {
  it("builds a paginated SELECT * with the given quoter", () => {
    expect(buildSelectAll({ name: "users" }, 100, 0, quoteIdentifier)).toBe(
      'SELECT * FROM "users" LIMIT 100 OFFSET 0'
    );
    expect(buildSelectAll({ schema: "main", name: "posts" }, 50, 50, quoteIdentifier)).toBe(
      'SELECT * FROM "main"."posts" LIMIT 50 OFFSET 50'
    );
  });

  it("supports backtick quoting (MySQL)", () => {
    expect(buildSelectAll({ schema: "app", name: "users" }, 10, 0, quoteBacktick)).toBe(
      "SELECT * FROM `app`.`users` LIMIT 10 OFFSET 0"
    );
  });

  it("supports offset-fetch pagination (SQL Server)", () => {
    expect(
      buildSelectAll({ schema: "dbo", name: "users" }, 25, 50, quoteBracket, "offset-fetch")
    ).toBe(
      "SELECT * FROM [dbo].[users] ORDER BY (SELECT NULL) OFFSET 50 ROWS FETCH NEXT 25 ROWS ONLY"
    );
  });

  it("builds a COUNT query", () => {
    expect(buildCount({ name: "users" }, quoteIdentifier)).toBe(
      'SELECT COUNT(*) AS count FROM "users"'
    );
  });
});
