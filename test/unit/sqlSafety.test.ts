import { describe, expect, it } from "vitest";
import { qualify, quoteIdentifier, quoteStringLiteral } from "../../src/utils/sqlSafety";

describe("sqlSafety", () => {
  it("quotes identifiers and escapes double quotes", () => {
    expect(quoteIdentifier("users")).toBe('"users"');
    expect(quoteIdentifier('we"ird')).toBe('"we""ird"');
  });

  it("quotes string literals and escapes single quotes", () => {
    expect(quoteStringLiteral("a")).toBe("'a'");
    expect(quoteStringLiteral("O'Brien")).toBe("'O''Brien'");
  });

  it("qualifies with optional schema", () => {
    expect(qualify(undefined, "t")).toBe('"t"');
    expect(qualify("main", "t")).toBe('"main"."t"');
  });
});
