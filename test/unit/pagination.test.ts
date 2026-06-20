import { describe, expect, it } from "vitest";
import { buildCount, buildSelectAll } from "../../src/adapters/common/pagination";

describe("pagination", () => {
  it("builds a paginated SELECT *", () => {
    expect(buildSelectAll({ name: "users" }, 100, 0)).toBe(
      'SELECT * FROM "users" LIMIT 100 OFFSET 0'
    );
    expect(buildSelectAll({ schema: "main", name: "posts" }, 50, 50)).toBe(
      'SELECT * FROM "main"."posts" LIMIT 50 OFFSET 50'
    );
  });

  it("builds a COUNT query", () => {
    expect(buildCount({ name: "users" })).toBe('SELECT COUNT(*) AS count FROM "users"');
  });
});
