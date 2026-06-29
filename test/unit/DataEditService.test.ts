import { describe, expect, it, vi } from "vitest";
import type { DatabaseAdapter, DbSession } from "../../src/adapters/DatabaseAdapter";
import type {
  ColumnInfo,
  ConnectionProfile,
  ForeignKeyInfo,
  IndexInfo,
  QueryResult
} from "../../src/core/types";
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

function fakeAdapter(
  dbType: string,
  placeholderStyle: "qmark" | "numbered" | "named",
  metadata: {
    columns?: ColumnInfo[];
    indexes?: IndexInfo[];
    foreignKeys?: ForeignKeyInfo[];
  } = {}
) {
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
    executeQuery,
    listColumns: vi.fn(async () => metadata.columns ?? []),
    listIndexes: vi.fn(async () => metadata.indexes ?? []),
    listForeignKeys: vi.fn(async () => metadata.foreignKeys ?? [])
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
    const result = await service(adapter).updateRow(
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
    expect(result.sql).toBe('UPDATE "public"."users" SET "name" = $1 WHERE "id" = $2');
    expect(result.params).toEqual(["Ann", 3]);
  });

  it("inserts a row", async () => {
    const { adapter, executeQuery } = fakeAdapter("sqlite", "qmark");
    const result = await service(adapter).insertRow(profile, ref, [
      { column: "name", value: "Bo" }
    ]);
    expect(executeQuery).toHaveBeenCalledWith(
      expect.anything(),
      'INSERT INTO "public"."users" ("name") VALUES (?)',
      { params: ["Bo"] }
    );
    expect(result.sql).toBe('INSERT INTO "public"."users" ("name") VALUES (?)');
    expect(result.params).toEqual(["Bo"]);
  });

  it("deletes a row by key", async () => {
    const { adapter, executeQuery } = fakeAdapter("sqlite", "qmark");
    const result = await service(adapter).deleteRow(profile, ref, [{ column: "id", value: 9 }]);
    expect(executeQuery).toHaveBeenCalledWith(
      expect.anything(),
      'DELETE FROM "public"."users" WHERE "id" = ?',
      { params: [9] }
    );
    expect(result.sql).toBe('DELETE FROM "public"."users" WHERE "id" = ?');
    expect(result.params).toEqual([9]);
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

  it("refuses to drop a primary-key column", async () => {
    const { adapter } = fakeAdapter("postgresql", "numbered", {
      columns: [
        {
          name: "id",
          dataType: "int",
          ordinal: 0,
          nullable: false,
          isPrimaryKey: true
        }
      ]
    });

    await expect(service(adapter).previewDropColumn(profile, ref, "id")).rejects.toThrow(
      /primary key/
    );
  });

  it("refuses to drop an indexed column", async () => {
    const { adapter } = fakeAdapter("postgresql", "numbered", {
      indexes: [{ name: "users_email_idx", unique: false, columns: ["email"] }]
    });

    await expect(service(adapter).previewDropColumn(profile, ref, "email")).rejects.toThrow(
      /Drop the index first/
    );
  });

  it("refuses to drop a foreign-key source column", async () => {
    const { adapter } = fakeAdapter("postgresql", "numbered", {
      foreignKeys: [
        {
          name: "users_org_id_fkey",
          source: { schema: "public", table: "users", columns: ["org_id"] },
          target: { schema: "public", table: "orgs", columns: ["id"] }
        }
      ]
    });

    await expect(service(adapter).previewDropColumn(profile, ref, "org_id")).rejects.toThrow(
      /Drop the foreign key first/
    );
  });

  it("refuses column drops for non-SQL column adapters", async () => {
    const { adapter } = fakeAdapter("mongodb", "qmark");
    await expect(service(adapter).previewDropColumn(profile, ref, "email")).rejects.toThrow(
      /does not support/
    );
  });
});
