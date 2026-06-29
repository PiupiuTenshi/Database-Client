import { describe, expect, it, vi } from "vitest";
import type { DatabaseAdapter, DbSession } from "../../src/adapters/DatabaseAdapter";
import type { ConnectionProfile, QueryResult } from "../../src/core/types";
import { QueryService } from "../../src/services/QueryService";
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

function result(rows: Record<string, unknown>[] = []): QueryResult {
  return {
    queryId: "q",
    columns: rows.length ? [{ name: "id", ordinal: 0 }] : [],
    rows,
    rowCount: rows.length,
    durationMs: 1
  };
}

function service(executeQuery: DatabaseAdapter["executeQuery"]): QueryService {
  const adapter = {
    dbType: "postgresql",
    paginationStyle: "limit-offset",
    placeholderStyle: "numbered",
    quoteIdentifier: (id: string) => `"${id}"`,
    executeQuery
  } as unknown as DatabaseAdapter;
  const session = { id: "s", dbType: "postgresql" } as DbSession;
  const sessionManager = {
    getOrConnect: async () => ({ adapter, session })
  } as unknown as SessionManager;
  return new QueryService(sessionManager);
}

describe("QueryService", () => {
  it("returns executed SQL and params for ad-hoc queries", async () => {
    const executeQuery = vi.fn(async () => result([{ id: 1 }]));
    const output = await service(executeQuery).execute(profile, "select * from users where id = $1", {
      params: [1]
    });

    expect(output.sql).toBe("select * from users where id = $1");
    expect(output.params).toEqual([1]);
  });

  it("returns the page SQL used by table browsing", async () => {
    const executeQuery = vi
      .fn()
      .mockResolvedValueOnce(result([{ id: 1 }]))
      .mockResolvedValueOnce(result([{ count: 7 }]));

    const page = await service(executeQuery).getTablePage(
      profile,
      { schema: "public", name: "users" },
      50,
      100
    );

    expect(page.result.sql).toBe('SELECT * FROM "public"."users" LIMIT 50 OFFSET 100');
    expect(executeQuery).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'SELECT COUNT(*) AS count FROM "public"."users"'
    );
  });
});
