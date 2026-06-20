import { describe, expect, it } from "vitest";
import { normalizeError } from "../../src/adapters/common/normalizeError";

describe("normalizeError", () => {
  it("maps Error with a string code", () => {
    const error = Object.assign(new Error("no such table"), { code: "SQLITE_ERROR" });
    expect(normalizeError(error)).toEqual({
      message: "no such table",
      code: "SQLITE_ERROR"
    });
  });

  it("maps a plain Error without code", () => {
    expect(normalizeError(new Error("boom"))).toEqual({ message: "boom", code: undefined });
  });

  it("maps an object-like error", () => {
    expect(normalizeError({ message: "x", code: "Y" })).toEqual({ message: "x", code: "Y" });
  });

  it("maps a primitive", () => {
    expect(normalizeError("plain string")).toEqual({ message: "plain string" });
  });
});
