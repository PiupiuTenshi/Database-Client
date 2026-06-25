import { describe, expect, it } from "vitest";
import {
  ClickHouseAdapter,
  CloudflareD1Adapter,
  TrinoAdapter,
  type HttpSqlExecutor,
  type HttpSqlResult
} from "../../src/adapters/httpSql/HttpSqlAdapter";
import type { RuntimeConnectionProfile } from "../../src/core/types";

function profile(dbType: RuntimeConnectionProfile["dbType"]): RuntimeConnectionProfile {
  return {
    id: "p1",
    name: dbType,
    dbType,
    host: "https://sql.example.test",
    database: "default",
    environment: "dev",
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    password: "token"
  };
}

class FakeExecutor implements HttpSqlExecutor {
  readonly calls: { sql: string; params?: unknown[] }[] = [];

  async execute(
    _profile: RuntimeConnectionProfile,
    sql: string,
    params?: unknown[]
  ): Promise<HttpSqlResult> {
    this.calls.push({ sql, params });
    if (sql.includes("sqlite_master") && sql.includes("table")) {
      return { rows: [{ table_name: "events" }] };
    }
    if (sql.includes("PRAGMA")) {
      return { rows: [{ name: "id", type: "INTEGER", pk: 1 }] };
    }
    if (sql.includes("system.databases")) {
      return { rows: [{ schema_name: "default" }] };
    }
    if (sql.includes("system.tables")) {
      return { rows: [{ table_name: "events", row_count: 12 }] };
    }
    if (sql.includes("system.columns")) {
      return { rows: [{ column_name: "id", data_type: "UInt64", ordinal_position: 1 }] };
    }
    if (sql.includes("information_schema.schemata")) {
      return { rows: [{ schema_name: "public" }] };
    }
    if (sql.includes("information_schema.tables")) {
      return { rows: [{ table_name: "orders" }] };
    }
    if (sql.includes("SELECT 1")) {
      return { rows: [{ ok: 1 }], columns: ["ok"] };
    }
    return { rows: [{ id: 1, name: "alpha" }], columns: ["id", "name"] };
  }
}

describe("HttpSqlAdapter", () => {
  it("supports SQLite-compatible D1 metadata without schema params", async () => {
    const executor = new FakeExecutor();
    const adapter = new CloudflareD1Adapter(executor);
    const session = await adapter.connect(profile("cloudflare-d1"));

    await expect(adapter.listTables(session)).resolves.toEqual([
      { name: "events", schema: undefined, type: "base_table", rowEstimate: undefined }
    ]);
    await expect(adapter.listColumns(session, { name: "events" })).resolves.toMatchObject([
      { name: "id", dataType: "INTEGER" }
    ]);
    expect(executor.calls.some((call) => call.params?.includes(undefined))).toBe(false);
  });

  it("maps ClickHouse schemas, tables, and columns", async () => {
    const adapter = new ClickHouseAdapter(new FakeExecutor());
    const session = await adapter.connect(profile("clickhouse"));

    await expect(adapter.listSchemas(session)).resolves.toEqual([
      { name: "default", isDefault: true }
    ]);
    await expect(adapter.listTables(session, "default")).resolves.toEqual([
      { name: "events", schema: "default", type: "base_table", rowEstimate: 12 }
    ]);
    await expect(adapter.listColumns(session, { schema: "default", name: "events" })).resolves.toMatchObject([
      { name: "id", dataType: "UInt64", ordinal: 1 }
    ]);
  });

  it("runs query results for Trino-compatible endpoints", async () => {
    const adapter = new TrinoAdapter(new FakeExecutor());
    const session = await adapter.connect(profile("trino"));
    const result = await adapter.executeQuery(session, "SELECT id, name FROM orders");

    expect(result.columns.map((column) => column.name)).toEqual(["id", "name"]);
    expect(result.rows).toEqual([{ id: 1, name: "alpha" }]);
  });
});
