import { describe, expect, it } from "vitest";
import {
  PostgresAdapter,
  type PgClient,
  type PgClientFactory,
  type PgQueryResult
} from "../../src/adapters/postgresql/PostgresAdapter";
import * as Q from "../../src/adapters/postgresql/postgresMetadataQueries";
import type { DbSession } from "../../src/adapters/DatabaseAdapter";
import type { RuntimeConnectionProfile } from "../../src/core/types";

type Router = (text: string, values?: unknown[]) => PgQueryResult;

function result(
  rows: Record<string, unknown>[],
  extra: Partial<PgQueryResult> = {}
): PgQueryResult {
  return {
    rows,
    fields: extra.fields ?? Object.keys(rows[0] ?? {}).map((name) => ({ name })),
    rowCount: extra.rowCount ?? rows.length,
    command: extra.command ?? "SELECT"
  };
}

function fakeFactory(router: Router, onConnect?: () => void): PgClientFactory {
  return () => {
    const client: PgClient = {
      connect: () => {
        onConnect?.();
        return Promise.resolve();
      },
      query: (text, values) => Promise.resolve(router(text, values)),
      end: () => Promise.resolve()
    };
    return client;
  };
}

const profile: RuntimeConnectionProfile = {
  id: "p",
  name: "pg",
  dbType: "postgresql",
  host: "localhost",
  port: 5432,
  username: "postgres",
  password: "secret",
  database: "app",
  environment: "local",
  tags: [],
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-06-20T00:00:00.000Z"
};

async function connect(router: Router): Promise<{ adapter: PostgresAdapter; session: DbSession }> {
  const adapter = new PostgresAdapter(fakeFactory(router));
  const session = await adapter.connect(profile);
  return { adapter, session };
}

describe("PostgresAdapter (mocked driver)", () => {
  it("lists schemas and flags the default", async () => {
    const { adapter, session } = await connect((text) => {
      if (text === Q.LIST_SCHEMAS) {
        return result([{ schema_name: "public" }, { schema_name: "app" }]);
      }
      return result([]);
    });
    const schemas = await adapter.listSchemas(session);
    expect(schemas).toEqual([
      { name: "public", isDefault: true },
      { name: "app", isDefault: false }
    ]);
  });

  it("lists tables for a schema", async () => {
    const { adapter, session } = await connect((text, values) => {
      if (text === Q.LIST_TABLES) {
        expect(values).toEqual(["app"]);
        return result([{ table_name: "users" }, { table_name: "orders" }]);
      }
      return result([]);
    });
    const tables = await adapter.listTables(session, "app");
    expect(tables).toEqual([
      { name: "users", schema: "app", type: "base_table" },
      { name: "orders", schema: "app", type: "base_table" }
    ]);
  });

  it("lists columns with primary key flags", async () => {
    const { adapter, session } = await connect((text) => {
      if (text === Q.LIST_COLUMNS) {
        return result([
          {
            column_name: "id",
            data_type: "integer",
            ordinal_position: 1,
            is_nullable: "NO",
            column_default: "nextval('users_id_seq')"
          },
          {
            column_name: "email",
            data_type: "text",
            ordinal_position: 2,
            is_nullable: "YES",
            column_default: null
          }
        ]);
      }
      if (text === Q.LIST_PRIMARY_KEYS) {
        return result([{ column_name: "id" }]);
      }
      return result([]);
    });
    const columns = await adapter.listColumns(session, { schema: "public", name: "users" });
    expect(columns[0]).toMatchObject({ name: "id", isPrimaryKey: true, nullable: false });
    expect(columns[1]).toMatchObject({ name: "email", isPrimaryKey: false, nullable: true });
    expect(columns[1].defaultValue).toBeUndefined();
  });

  it("groups composite foreign keys by constraint name", async () => {
    const { adapter, session } = await connect((text) => {
      if (text === Q.LIST_FOREIGN_KEYS) {
        return result([
          {
            constraint_name: "fk_orders_user",
            source_column: "user_id",
            target_table: "users",
            target_column: "id",
            update_rule: "NO ACTION",
            delete_rule: "CASCADE"
          }
        ]);
      }
      return result([]);
    });
    const fks = await adapter.listForeignKeys(session, { schema: "public", name: "orders" });
    expect(fks).toHaveLength(1);
    expect(fks[0]).toMatchObject({
      name: "fk_orders_user",
      onDelete: "CASCADE",
      source: { schema: "public", table: "orders", columns: ["user_id"] },
      target: { table: "users", columns: ["id"] }
    });
  });

  it("groups index columns by index name", async () => {
    const { adapter, session } = await connect((text) => {
      if (text === Q.LIST_INDEXES) {
        return result([
          { index_name: "users_pkey", is_unique: true, column_name: "id" },
          { index_name: "users_name_idx", is_unique: false, column_name: "first" },
          { index_name: "users_name_idx", is_unique: false, column_name: "last" }
        ]);
      }
      return result([]);
    });
    const indexes = await adapter.listIndexes(session, { schema: "public", name: "users" });
    expect(indexes).toEqual([
      { name: "users_pkey", unique: true, columns: ["id"] },
      { name: "users_name_idx", unique: false, columns: ["first", "last"] }
    ]);
  });

  it("maps a SELECT result", async () => {
    const { adapter, session } = await connect(() =>
      result([{ id: 1, name: "a" }], { command: "SELECT" })
    );
    const r = await adapter.executeQuery(session, "SELECT * FROM users");
    expect(r.columns).toEqual([
      { name: "id", ordinal: 0 },
      { name: "name", ordinal: 1 }
    ]);
    expect(r.rowCount).toBe(1);
    expect(r.affectedRows).toBeUndefined();
  });

  it("reports affectedRows for writes", async () => {
    const { adapter, session } = await connect(() =>
      result([], { command: "UPDATE", rowCount: 3, fields: [] })
    );
    const r = await adapter.executeQuery(session, "UPDATE users SET x = 1");
    expect(r.affectedRows).toBe(3);
    expect(r.rowCount).toBe(0);
  });

  it("truncates rows by maxRows", async () => {
    const { adapter, session } = await connect(() => result([{ id: 1 }, { id: 2 }, { id: 3 }]));
    const r = await adapter.executeQuery(session, "SELECT * FROM users", { maxRows: 2 });
    expect(r.rows).toHaveLength(2);
    expect(r.truncated).toBe(true);
  });
});

describe("PostgresAdapter.testConnection", () => {
  it("returns ok when connect + SELECT 1 succeed", async () => {
    const adapter = new PostgresAdapter(fakeFactory(() => result([{ "?column?": 1 }])));
    expect((await adapter.testConnection(profile)).ok).toBe(true);
  });

  it("returns not ok when connect throws", async () => {
    const adapter = new PostgresAdapter(
      fakeFactory(
        () => result([]),
        () => {
          throw new Error("ECONNREFUSED");
        }
      )
    );
    const r = await adapter.testConnection(profile);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("ECONNREFUSED");
  });
});
