import { describe, expect, it } from "vitest";
import type { ConnectionProfile } from "../../src/core/types";
import { getWarehouseQueryWarnings, isWarehouseConnection } from "../../src/utils/warehouseGuard";

function profile(dbType: ConnectionProfile["dbType"]): ConnectionProfile {
  return {
    id: "p1",
    name: dbType,
    dbType,
    environment: "dev",
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("warehouseGuard", () => {
  it("detects warehouse connections", () => {
    expect(isWarehouseConnection(profile("clickhouse"))).toBe(true);
    expect(isWarehouseConnection(profile("postgresql"))).toBe(false);
  });

  it("warns on warehouse selects without caps or filters", () => {
    expect(getWarehouseQueryWarnings(profile("trino"), "SELECT * FROM orders")).toEqual([
      { code: "warehouse-no-limit", message: "Warehouse query has no LIMIT/FETCH cap." },
      { code: "warehouse-full-scan", message: "Warehouse query may scan a full table." }
    ]);
  });

  it("does not warn when a capped filtered query is used", () => {
    expect(
      getWarehouseQueryWarnings(
        profile("redshift"),
        "SELECT * FROM orders WHERE created_at >= '2026-01-01' LIMIT 100"
      )
    ).toEqual([]);
  });
});
