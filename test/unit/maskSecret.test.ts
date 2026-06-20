import { describe, expect, it } from "vitest";
import { maskSecret } from "../../src/utils/maskSecret";

describe("maskSecret", () => {
  it("returns empty string for empty/undefined", () => {
    expect(maskSecret(undefined)).toBe("");
    expect(maskSecret(null)).toBe("");
    expect(maskSecret("")).toBe("");
  });

  it("fully masks short values", () => {
    expect(maskSecret("abcd")).toBe("****");
    expect(maskSecret("ab")).toBe("****");
  });

  it("keeps only first/last two chars for longer values", () => {
    expect(maskSecret("abcdef")).toBe("ab****ef");
    expect(maskSecret("RootPassword_123!")).toBe("Ro****3!");
  });
});
