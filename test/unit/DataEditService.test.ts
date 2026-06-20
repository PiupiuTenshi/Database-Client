import { describe, expect, it, vi } from "vitest";
import type { DatabaseAdapter, DbSession } from "../../src/adapters/DatabaseAdapter";
import type { ConnectionProfile, QueryResult } from "../../src/core/types";
import { DataEditService } from "../../src/services/DataEditService";
import type { SessionManager } from "../../src/services/SessionManager";

const profile = {
  id: "1",
  name: "db",
  dbType: "postgresql",
  environment: "local",
  tags: [],
  createdAt: "",
  updatedAt: ""
} as ConnectionProfile;

const ref = { name: "users", schema: "public" };

function fakeAdapter(dbType: string, placeholderStyle: "qmark" | "numbered" | "named") {
  const executeQuery = vi.fn(
    async (): Promise<QueryResult> => ({
      queryId: "q",
      columns: [],
      rows: [],
      rowCount: 0,
      affectedRows: 1,
      durationMs: 1
    })
  );
  const adapter = {
    dbType,
    placeholderStyle,
    quoteIdentifier: (id: string) => `"${id}"`,
    executeQuery
  } as unknown as DatabaseAdapter;
  return { adapter, executeQuery };
}

function service(adapter: DatabaseAdapter): DataEditService {
  const session = { id: "s", dbType: "postgresql" } as DbSession;
  const sessionManager = {
    getOrConnect: async () => ({ adapter, session })
  } as unknown as SessionManager;
  return new DataEditService(sessionManager);
}

describe("DataEditService", () => {
  it("updates a row with parameterized SQL", async () => {
    const { adapter, executeQuery } = fakeAdapter("postgresql", "numbered");
    await service(adapter).updateRow(
      profile,
      ref,
      [{ column: "name", value: "Ann" }],
      [{ column: "id", value: 3 }]
    );
    expect(executeQuery).toHaveBeenCalledWith(
      expect.anything(),
      'UPDATE "public"."users" SET "name" = $1 WHERE "id" = $2',
      { params: ["Ann", 3] }
    );
  });

  it("inserts a row", async () => {
    const { adapter, executeQuery } = fakeAdapter("sqlite", "qmark");
    await service(adapter).insertRow(profile, ref, [{ column: "name", value: "Bo" }]);
    expect(executeQuery).toHaveBeenCalledWith(
      expect.anything(),
      'INSERT INTO "public"."users" ("name") VALUES (?)',
      { params: ["Bo"] }
    );
  });

  it("deletes a row by key", async () => {
    const { adapter, executeQuery } = fakeAdapter("sqlite", "qmark");
    await service(adapter).deleteRow(profile, ref, [{ column: "id", value: 9 }]);
    expect(executeQuery).toHaveBeenCalledWith(
      expect.anything(),
      'DELETE FROM "public"."users" WHERE "id" = ?',
      { params: [9] }
    );
  });

  it("previews ADD COLUMN per dialect", async () => {
    const pg = fakeAdapter("postgresql", "numbered");
    const ddl = await service(pg.adapter).previewAddColumn(profile, ref, {
      name: "email",
      dataType: "text",
      nullable: true
    });
    expect(ddl).toBe('ALTER TABLE "public"."users" ADD COLUMN "email" text');

    const mssql = fakeAdapter("sqlserver", "named");
    const ddl2 = await service(mssql.adapter).previewAddColumn(profile, ref, {
      name: "email",
      dataType: "nvarchar(50)",
      nullable: true
    });
    expect(ddl2).toBe('ALTER TABLE "public"."users" ADD "email" nvarchar(50)');
  });

  it("previews DROP COLUMN", async () => {
    const { adapter } = fakeAdapter("postgresql", "numbered");
    const ddl = await service(adapter).previewDropColumn(profile, ref, "email");
    expect(ddl).toBe('ALTER TABLE "public"."users" DROP COLUMN "email"');
  });
});
