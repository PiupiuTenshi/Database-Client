import { describe, expect, it } from "vitest";
import type { DatabaseAdapter } from "../../src/adapters/DatabaseAdapter";
import {
  AzureSqlAdapter,
  CockroachDbAdapter,
  DorisAdapter,
  GaussDbAdapter,
  KingbaseAdapter,
  RedshiftAdapter
} from "../../src/adapters/compat/CompatibilityAdapters";
import { DuckDbAdapter } from "../../src/adapters/duckdb/DuckDbAdapter";
import {
  ClickHouseAdapter,
  CloudflareD1Adapter,
  PrestoAdapter,
  TrinoAdapter,
  TursoAdapter
} from "../../src/adapters/httpSql/HttpSqlAdapter";
import { MongoDbAdapter } from "../../src/adapters/mongodb/MongoDbAdapter";
import { MySqlAdapter } from "../../src/adapters/mysql/MySqlAdapter";
import { OracleAdapter } from "../../src/adapters/oracle/OracleAdapter";
import { PostgresAdapter } from "../../src/adapters/postgresql/PostgresAdapter";
import { RedisAdapter } from "../../src/adapters/redis/RedisAdapter";
import { SqlServerAdapter } from "../../src/adapters/sqlserver/SqlServerAdapter";
import { SqliteAdapter } from "../../src/adapters/sqlite/SqliteAdapter";

/**
 * Contract test chung: mọi adapter phải tuân thủ cùng một shape interface
 * (props readonly hợp lệ + đầy đủ method). Bắt sớm khi thêm adapter mới mà
 * quên implement một method của DatabaseAdapter.
 */
const adapters: { name: string; adapter: DatabaseAdapter }[] = [
  { name: "sqlite", adapter: new SqliteAdapter() },
  { name: "postgresql", adapter: new PostgresAdapter() },
  { name: "mysql", adapter: new MySqlAdapter("mysql") },
  { name: "mariadb", adapter: new MySqlAdapter("mariadb") },
  { name: "sqlserver", adapter: new SqlServerAdapter() },
  { name: "duckdb", adapter: new DuckDbAdapter() },
  { name: "mongodb", adapter: new MongoDbAdapter() },
  { name: "oracle", adapter: new OracleAdapter() },
  { name: "cloudflare-d1", adapter: new CloudflareD1Adapter() },
  { name: "turso", adapter: new TursoAdapter() },
  { name: "azuresql", adapter: new AzureSqlAdapter() },
  { name: "cockroachdb", adapter: new CockroachDbAdapter() },
  { name: "gaussdb", adapter: new GaussDbAdapter() },
  { name: "kingbase", adapter: new KingbaseAdapter() },
  { name: "redshift", adapter: new RedshiftAdapter() },
  { name: "doris", adapter: new DorisAdapter() },
  { name: "clickhouse", adapter: new ClickHouseAdapter() },
  { name: "trino", adapter: new TrinoAdapter() },
  { name: "presto", adapter: new PrestoAdapter() },
  { name: "redis", adapter: new RedisAdapter() }
];

const REQUIRED_METHODS: (keyof DatabaseAdapter)[] = [
  "quoteIdentifier",
  "connect",
  "testConnection",
  "disconnect",
  "listSchemas",
  "listTables",
  "listViews",
  "listColumns",
  "listIndexes",
  "listForeignKeys",
  "listTriggers",
  "listCheckConstraints",
  "listViewDependencies",
  "getObjectDDL",
  "executeQuery"
];

describe("DatabaseAdapter contract", () => {
  for (const { name, adapter } of adapters) {
    describe(name, () => {
      it("declares a matching dbType", () => {
        expect(adapter.dbType).toBe(name);
      });

      it("declares valid pagination and placeholder styles", () => {
        expect(["limit-offset", "offset-fetch"]).toContain(adapter.paginationStyle);
        expect(["qmark", "numbered", "named", "colon"]).toContain(adapter.placeholderStyle);
      });

      it("implements every required method", () => {
        for (const method of REQUIRED_METHODS) {
          expect(typeof adapter[method]).toBe("function");
        }
      });

      it("quotes identifiers as a non-empty string", () => {
        expect(adapter.quoteIdentifier("x").length).toBeGreaterThan(0);
      });
    });
  }
});
