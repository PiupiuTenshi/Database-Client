import { describe, expect, it } from "vitest";
import type { ColumnInfo } from "../../src/core/types";
import { generateCSharp, generateCrud, generateTypeScript } from "../../src/utils/codeGen";

const q = (id: string): string => `"${id}"`;
const ref = { name: "user_account", schema: "public" };
const columns: ColumnInfo[] = [
  { name: "id", dataType: "integer", ordinal: 1, nullable: false, isPrimaryKey: true },
  { name: "email", dataType: "varchar", ordinal: 2, nullable: false, isPrimaryKey: false },
  { name: "age", dataType: "integer", ordinal: 3, nullable: true, isPrimaryKey: false }
];

describe("generateTypeScript", () => {
  it("creates a PascalCase interface with mapped types", () => {
    const ts = generateTypeScript(ref, columns);
    expect(ts).toContain("export interface UserAccount {");
    expect(ts).toContain("id: number;");
    expect(ts).toContain("email: string;");
    expect(ts).toContain("age?: number | null;");
  });
});

describe("generateCSharp", () => {
  it("creates a class with nullable value types", () => {
    const cs = generateCSharp(ref, columns);
    expect(cs).toContain("public class UserAccount");
    expect(cs).toContain("public int Id { get; set; }");
    expect(cs).toContain("public string Email { get; set; }");
    expect(cs).toContain("public int? Age { get; set; }");
  });
});

describe("generateCrud", () => {
  it("creates SELECT/INSERT/UPDATE/DELETE keyed by primary key", () => {
    const sql = generateCrud(ref, columns, q);
    expect(sql).toContain(
      'SELECT "id", "email", "age" FROM "public"."user_account" WHERE "id" = $1;'
    );
    expect(sql).toContain(
      'INSERT INTO "public"."user_account" ("id", "email", "age") VALUES ($1, $2, $3);'
    );
    expect(sql).toContain('UPDATE "public"."user_account" SET');
    expect(sql).toContain('DELETE FROM "public"."user_account" WHERE "id" = $1;');
  });
});
