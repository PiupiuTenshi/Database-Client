import { describe, expect, it } from "vitest";
import {
  buildAddColumn,
  buildDeleteByKey,
  buildDropColumn,
  buildInsert,
  buildUpdateByKey,
  placeholder
} from "../../src/utils/rowMutation";

const q = (id: string): string => `"${id.replace(/"/g, '""')}"`;
const ref = { name: "users", schema: "public" };

describe("placeholder", () => {
  it("emits the right token per dialect", () => {
    expect(placeholder("qmark", 1)).toBe("?");
    expect(placeholder("qmark", 5)).toBe("?");
    expect(placeholder("numbered", 1)).toBe("$1");
    expect(placeholder("numbered", 3)).toBe("$3");
    expect(placeholder("named", 2)).toBe("@p2");
  });
});

describe("buildInsert", () => {
  it("builds a parameterized insert with qmark", () => {
    const stmt = buildInsert(
      ref,
      [
        { column: "name", value: "Ann" },
        { column: "age", value: 30 }
      ],
      q,
      "qmark"
    );
    expect(stmt.sql).toBe('INSERT INTO "public"."users" ("name", "age") VALUES (?, ?)');
    expect(stmt.params).toEqual(["Ann", 30]);
  });

  it("uses numbered placeholders for postgres style", () => {
    const stmt = buildInsert(ref, [{ column: "name", value: "Ann" }], q, "numbered");
    expect(stmt.sql).toBe('INSERT INTO "public"."users" ("name") VALUES ($1)');
  });

  it("rejects an empty insert", () => {
    expect(() => buildInsert(ref, [], q, "qmark")).toThrow(/at least one column/);
  });
});

describe("buildUpdateByKey", () => {
  it("numbers set then where with numbered placeholders", () => {
    const stmt = buildUpdateByKey(
      ref,
      [
        { column: "name", value: "Bob" },
        { column: "age", value: 31 }
      ],
      [{ column: "id", value: 7 }],
      q,
      "numbered"
    );
    expect(stmt.sql).toBe('UPDATE "public"."users" SET "name" = $1, "age" = $2 WHERE "id" = $3');
    expect(stmt.params).toEqual(["Bob", 31, 7]);
  });

  it("supports composite keys", () => {
    const stmt = buildUpdateByKey(
      ref,
      [{ column: "v", value: 1 }],
      [
        { column: "a", value: "x" },
        { column: "b", value: "y" }
      ],
      q,
      "qmark"
    );
    expect(stmt.sql).toBe('UPDATE "public"."users" SET "v" = ? WHERE "a" = ? AND "b" = ?');
    expect(stmt.params).toEqual([1, "x", "y"]);
  });

  it("refuses to update without a key (no full-table writes)", () => {
    expect(() => buildUpdateByKey(ref, [{ column: "v", value: 1 }], [], q, "qmark")).toThrow(/key/);
  });

  it("refuses to update with no changed columns", () => {
    expect(() => buildUpdateByKey(ref, [], [{ column: "id", value: 1 }], q, "qmark")).toThrow(
      /at least one column/
    );
  });
});

describe("buildDeleteByKey", () => {
  it("builds a keyed delete", () => {
    const stmt = buildDeleteByKey(ref, [{ column: "id", value: 9 }], q, "named");
    expect(stmt.sql).toBe('DELETE FROM "public"."users" WHERE "id" = @p1');
    expect(stmt.params).toEqual([9]);
  });

  it("refuses to delete without a key", () => {
    expect(() => buildDeleteByKey(ref, [], q, "qmark")).toThrow(/key/);
  });
});

describe("buildAddColumn / buildDropColumn", () => {
  it("builds ADD COLUMN for standard dialects", () => {
    const sql = buildAddColumn(ref, { name: "email", dataType: "text", nullable: false }, q);
    expect(sql).toBe('ALTER TABLE "public"."users" ADD COLUMN "email" text NOT NULL');
  });

  it("uses ADD (no COLUMN keyword) for sql server", () => {
    const sql = buildAddColumn(
      ref,
      { name: "email", dataType: "nvarchar(255)", nullable: true },
      q,
      "ADD"
    );
    expect(sql).toBe('ALTER TABLE "public"."users" ADD "email" nvarchar(255)');
  });

  it("includes a default expression when provided", () => {
    const sql = buildAddColumn(
      ref,
      { name: "active", dataType: "boolean", nullable: false, defaultValue: "true" },
      q
    );
    expect(sql).toBe(
      'ALTER TABLE "public"."users" ADD COLUMN "active" boolean NOT NULL DEFAULT true'
    );
  });

  it("builds DROP COLUMN", () => {
    expect(buildDropColumn(ref, "email", q)).toBe(
      'ALTER TABLE "public"."users" DROP COLUMN "email"'
    );
  });

  it("validates required fields", () => {
    expect(() => buildAddColumn(ref, { name: "", dataType: "int", nullable: true }, q)).toThrow();
    expect(() => buildAddColumn(ref, { name: "x", dataType: "", nullable: true }, q)).toThrow();
    expect(() => buildDropColumn(ref, "", q)).toThrow();
  });
});
