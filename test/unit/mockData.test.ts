import { describe, expect, it } from "vitest";
import { generateRows, generateValue, inferKind, makeRng } from "../../src/utils/mockData";

describe("inferKind", () => {
  it("maps SQL types to generator kinds", () => {
    expect(inferKind("integer")).toBe("int");
    expect(inferKind("bigint")).toBe("int");
    expect(inferKind("numeric(10,2)")).toBe("decimal");
    expect(inferKind("boolean")).toBe("boolean");
    expect(inferKind("timestamp")).toBe("datetime");
    expect(inferKind("date")).toBe("date");
    expect(inferKind("uuid")).toBe("uuid");
    expect(inferKind("jsonb")).toBe("json");
    expect(inferKind("varchar", "user_email")).toBe("email");
    expect(inferKind("text", "full_name")).toBe("name");
    expect(inferKind("text")).toBe("text");
  });
});

describe("makeRng", () => {
  it("is deterministic for the same seed", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("generateValue", () => {
  it("produces values of the expected shape", () => {
    const rng = makeRng(7);
    expect(typeof generateValue("int", rng, 1)).toBe("number");
    expect(typeof generateValue("boolean", rng, 1)).toBe("boolean");
    expect(generateValue("uuid", rng, 1)).toMatch(/^[0-9a-f-]{36}$/);
    expect(generateValue("email", rng, 5)).toContain("@example.com");
    expect(generateValue("date", rng, 1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("generateRows", () => {
  const columns = [
    { name: "id", dataType: "integer", nullable: false, isPrimaryKey: true },
    { name: "name", dataType: "text", nullable: false, isPrimaryKey: false },
    { name: "note", dataType: "text", nullable: true, isPrimaryKey: false }
  ];

  it("skips integer primary keys and produces the requested count", () => {
    const rows = generateRows(columns, { count: 3, seed: 1 });
    expect(rows).toHaveLength(3);
    expect(rows[0].map((c) => c.column)).toEqual(["name", "note"]);
  });

  it("is deterministic for the same seed", () => {
    expect(generateRows(columns, { count: 2, seed: 9 })).toEqual(
      generateRows(columns, { count: 2, seed: 9 })
    );
  });

  it("emits NULL for nullable columns when nullRatio is 1", () => {
    const rows = generateRows(columns, { count: 4, seed: 3, nullRatio: 1 });
    for (const row of rows) {
      expect(row.find((c) => c.column === "note")?.value).toBeNull();
    }
  });
});
