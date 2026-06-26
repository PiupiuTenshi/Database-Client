import { describe, expect, it } from "vitest";
import { compareVersions } from "../../src/services/UpdateService";

describe("UpdateService", () => {
  it("compares semantic versions with or without v prefix", () => {
    expect(compareVersions("v1.14.0", "1.13.0")).toBe(1);
    expect(compareVersions("1.13.0", "v1.13.0")).toBe(0);
    expect(compareVersions("1.9.0", "1.10.0")).toBe(-1);
  });
});
