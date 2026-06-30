import { describe, expect, it, vi } from "vitest";
import type { ConnectionProfile } from "../../src/core/types";
import { BackupService } from "../../src/services/BackupService";
import type { ExportService } from "../../src/services/ExportService";
import type { SchemaService } from "../../src/services/SchemaService";

const profile = { id: "1", name: "db", dbType: "sqlite" } as ConnectionProfile;

describe("BackupService", () => {
  it("assembles DDL + INSERT per table and reports progress", async () => {
    const schemaService = {
      listSchemas: vi.fn().mockResolvedValue([]),
      listTables: vi.fn().mockResolvedValue([{ name: "users", type: "base_table" }]),
      listViews: vi.fn().mockResolvedValue([]),
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

  it("exports all schemas and includes view DDL without fetching view rows", async () => {
    const schemaService = {
      listSchemas: vi.fn().mockResolvedValue([{ name: "public" }, { name: "audit" }]),
      listTables: vi
        .fn()
        .mockImplementation((_profile: ConnectionProfile, schema?: string) =>
          Promise.resolve([{ name: `${schema}_users`, schema, type: "base_table" }])
        ),
      listViews: vi
        .fn()
        .mockImplementation((_profile: ConnectionProfile, schema?: string) =>
          Promise.resolve(schema === "public" ? [{ name: "active_users", schema, type: "view" }] : [])
        ),
      getObjectDDL: vi
        .fn()
        .mockImplementation((_profile: ConnectionProfile, ref: { schema?: string; name: string }) =>
          Promise.resolve(`CREATE ${ref.name === "active_users" ? "VIEW" : "TABLE"} ${ref.name}`)
        )
    } as unknown as SchemaService;
    const fetchAll = vi.fn().mockResolvedValue({
      columns: ["id"],
      rows: [{ id: 1 }],
      truncated: false
    });
    const exportService = {
      quoteFn: vi.fn().mockResolvedValue((id: string) => `"${id}"`),
      fetchAll
    } as unknown as ExportService;

    const sql = await new BackupService(schemaService, exportService).backup(profile, undefined);

    expect(sql).toContain("-- tables: 2");
    expect(sql).toContain("-- views: 1");
    expect(sql).toContain("-- ===== TABLE public.public_users =====");
    expect(sql).toContain("-- ===== TABLE audit.audit_users =====");
    expect(sql).toContain("-- ===== VIEW public.active_users =====");
    expect(fetchAll).toHaveBeenCalledTimes(2);
  });
});
