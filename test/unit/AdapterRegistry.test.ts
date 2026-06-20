import { describe, expect, it } from "vitest";
import { AdapterRegistry } from "../../src/adapters/AdapterRegistry";
import type { DatabaseAdapter } from "../../src/adapters/DatabaseAdapter";

const fakeSqlite = { dbType: "sqlite" } as unknown as DatabaseAdapter;

describe("AdapterRegistry", () => {
  it("registers and resolves adapters by dbType", () => {
    const registry = new AdapterRegistry();
    expect(registry.has("sqlite")).toBe(false);

    registry.register(fakeSqlite);

    expect(registry.has("sqlite")).toBe(true);
    expect(registry.get("sqlite")).toBe(fakeSqlite);
    expect(registry.get("postgresql")).toBeUndefined();
  });
});
