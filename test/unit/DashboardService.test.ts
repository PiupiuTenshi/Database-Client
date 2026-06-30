import { describe, expect, it, vi } from "vitest";
import type { ConnectionProfile } from "../../src/core/types";
import { DashboardService, formatDatabaseVersion } from "../../src/services/DashboardService";
import type { QueryService } from "../../src/services/QueryService";
import type { SchemaService } from "../../src/services/SchemaService";

describe("formatDatabaseVersion", () => {
  it("keeps connection tree version labels compact", () => {
    expect(formatDatabaseVersion("PostgreSQL 16.3 on x86_64-pc-linux-gnu", "postgresql")).toBe(
      "PostgreSQL 16.3"
    );
    expect(formatDatabaseVersion("Microsoft SQL Server 2019 (RTM-CU25)", "sqlserver")).toBe(
      "SQL Server 2019"
    );
    expect(formatDatabaseVersion("3.45.1", "sqlite")).toBe("SQLite 3.45.1");
  });
});

describe("DashboardService", () => {
  it("returns a formatted best-effort version", async () => {
    const profile = { dbType: "mysql" } as ConnectionProfile;
    const service = new DashboardService({} as SchemaService, {
      execute: vi.fn().mockResolvedValue({
        rows: [{ v: "8.4.2-commercial" }]
      })
    } as unknown as QueryService);

    await expect(service.getVersion(profile)).resolves.toBe("MySQL 8.4.2");
  });
});
