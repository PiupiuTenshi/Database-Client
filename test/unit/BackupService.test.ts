import { describe, expect, it, vi } from "vitest";
import type { ConnectionProfile } from "../../src/core/types";
import { BackupService } from "../../src/services/BackupService";
import type { ExportService } from "../../src/services/ExportService";
import type { SchemaService } from "../../src/services/SchemaService";

const profile = { id: "1", name: "db", dbType: "sqlite" } as ConnectionProfile;

describe("BackupService", () => {
  it("assembles DDL + INSERT per table and reports progress", async () => {
    const schemaService = {
      listTables: vi.fn().mockResolvedValue([{ name: "users", type: "base_table" }]),
      getObjectDDL: vi.fn().mockResolvedValue("CREATE TABLE users (id INTEGER)")
    } as unknown as SchemaService;
    const exportService = {
      quoteFn: vi.fn().mockResolvedValue((id: string) => `"${id}"`),
      fetchAll: vi.fn().mockResolvedValue({
        columns: ["id"],
        rows: [{ id: 1 }, { id: 2 }],
        truncated: false
      })
    } as unknown as ExportService;

    const progress: string[] = [];
    const sql = await new BackupService(schemaService, exportService).backup(
      profile,
      undefined,
      (p) => progress.push(p.table)
    );

    expect(sql).toContain("CREATE TABLE users (id INTEGER);");
    expect(sql).toContain('INSERT INTO "users" ("id") VALUES (1);');
    expect(sql).toContain("VALUES (2);");
    expect(progress).toEqual(["users"]);
  });
});
