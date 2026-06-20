import { describe, expect, it } from "vitest";
import type { ConnectionProfile } from "../../src/core/types";
import { isProduction, productionWriteWarning } from "../../src/utils/productionGuard";

function profile(environment: ConnectionProfile["environment"]): ConnectionProfile {
  return {
    id: "1",
    name: "prod-db",
    dbType: "postgresql",
    environment,
    tags: [],
    createdAt: "",
    updatedAt: ""
  };
}

describe("productionGuard", () => {
  it("detects production connections", () => {
    expect(isProduction(profile("production"))).toBe(true);
    expect(isProduction(profile("local"))).toBe(false);
    expect(isProduction(profile("staging"))).toBe(false);
  });

  it("returns a warning only for production writes", () => {
    expect(productionWriteWarning(profile("local"), "update")).toBeUndefined();
    const warning = productionWriteWarning(profile("production"), "delete");
    expect(warning).toContain("PRODUCTION");
    expect(warning).toContain("prod-db");
    expect(warning).toContain("delete a row");
  });
});
