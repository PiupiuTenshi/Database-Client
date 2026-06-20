import { describe, expect, it } from "vitest";
import {
  MySqlAdapter,
  type MySqlClient,
  type MySqlClientFactory,
  type MySqlQueryResult
} from "../../src/adapters/mysql/MySqlAdapter";
import * as Q from "../../src/adapters/mysql/mysqlMetadataQueries";
import type { DbSession } from "../../src/adapters/DatabaseAdapter";
import type { RuntimeConnectionProfile } from "../../src/core/types";

type Router = (text: string, values?: unknown[]) => MySqlQueryResult;

function result(
  rows: Record<string, unknown>[],
  extra: Partial<MySqlQueryResult> = {}
): MySqlQueryResult {
  return {
    rows,
    fields: extra.fields ?? Object.keys(rows[0] ?? {}).map((name) => ({ name })),
    affectedRows: extra.affectedRows
  };
}

function fakeFactory(router: Router): MySqlClientFactory {
  return () => {
    const client: MySqlClient = {
      query: (text, values) => Promise.resolve(router(text, values)),
      end: () => Promise.resolve()
    };
    return Promise.resolve(client);
  };
}

const profile: RuntimeConnectionProfile = {
  id: "m",
  name: "my",
  dbType: "mysql",
  host: "localhost",
  port: 3306,
  username: "root",
  password: "secret",
  database: "app_db",
  environment: "local",
  tags: [],
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-06-20T00:00:00.000Z"
};

async function connect(router: Router): Promise<{ adapter: MySqlAdapter; session: DbSession }> {
  const adapter = new MySqlAdapter("mysql", fakeFactory(router));
  const session = await adapter.connect(profile);
  return { adapter, session };
}

describe("MySqlAdapter (mocked driver)", () => {
  it("quotes identifiers with backticks", () => {
    expect(new MySqlAdapter().quoteIdentifier("ta`ble")).toBe("`ta``ble`");
  });

  it("lists schemas (databases)", async () => {
    const { adapter, session } = await connect((text) =>
      text === Q.LIST_SCHEMAS
        ? result([{ schema_name: "app_db" }, { schema_name: "shop" }])
        : result([])
    );
    const schemas = await adapter.listSchemas(session);
    expect(schemas.map((s) => s.name)).toEqual(["app_db", "shop"]);
  });

  it("lists tables for a schema", async () => {
    const { adapter, session } = await connect((text, values) => {
      if (text === Q.LIST_TABLES) {
        expect(values).toEqual(["app_db"]);
        return result([{ table_name: "users" }]);
      }
      return result([]);
    });
    const tables = await adapter.listTables(session, "app_db");
    expect(tables).toEqual([{ name: "users", schema: "app_db", type: "base_table" }]);
  });

  it("detects primary keys from column_key", async () => {
    const { adapter, session } = await connect((text) =>
      text === Q.LIST_COLUMNS
        ? result([
            {
              column_name: "id",
              data_type: "int",
              ordinal_position: 1,
              is_nullable: "NO",
              column_default: null,
              column_key: "PRI"
            },
            {
              column_name: "name",
              data_type: "varchar",
              ordinal_position: 2,
              is_nullable: "YES",
              column_default: null,
              column_key: ""
            }
          ])
        : result([])
    );
    const columns = await adapter.listColumns(session, { schema: "app_db", name: "users" });
    expect(columns[0]).toMatchObject({ name: "id", isPrimaryKey: true, nullable: false });
    expect(columns[1].isPrimaryKey).toBe(false);
  });

  it("groups foreign keys by constraint", async () => {
    const { adapter, session } = await connect((text) =>
      text === Q.LIST_FOREIGN_KEYS
        ? result([
            {
              constraint_name: "orders_ibfk_1",
              source_column: "user_id",
              target_table: "users",
              target_column: "id",
              update_rule: "RESTRICT",
              delete_rule: "CASCADE"
            }
          ])
        : result([])
    );
    const fks = await adapter.listForeignKeys(session, { schema: "app_db", name: "orders" });
    expect(fks[0]).toMatchObject({
      name: "orders_ibfk_1",
      onDelete: "CASCADE",
      source: { schema: "app_db", table: "orders", columns: ["user_id"] },
      target: { table: "users", columns: ["id"] }
    });
  });

  it("maps unique flag from non_unique", async () => {
    const { adapter, session } = await connect((text) =>
      text === Q.LIST_INDEXES
        ? result([
            { index_name: "PRIMARY", non_unique: 0, column_name: "id", seq_in_index: 1 },
            { index_name: "idx_name", non_unique: 1, column_name: "name", seq_in_index: 1 }
          ])
        : result([])
    );
    const indexes = await adapter.listIndexes(session, { schema: "app_db", name: "users" });
    expect(indexes).toEqual([
      { name: "PRIMARY", unique: true, columns: ["id"] },
      { name: "idx_name", unique: false, columns: ["name"] }
    ]);
  });

  it("reads DDL from SHOW CREATE TABLE", async () => {
    const { adapter, session } = await connect((text) =>
      text.startsWith("SHOW CREATE TABLE")
        ? result([{ Table: "users", "Create Table": "CREATE TABLE `users` (...)" }])
        : result([])
    );
    const ddl = await adapter.getObjectDDL(session, { schema: "app_db", name: "users" });
    expect(ddl).toContain("CREATE TABLE");
  });

  it("maps SELECT vs write results", async () => {
    const selectCtx = await connect(() => result([{ id: 1 }], { fields: [{ name: "id" }] }));
    const selectResult = await selectCtx.adapter.executeQuery(selectCtx.session, "SELECT 1");
    expect(selectResult.columns).toEqual([{ name: "id", ordinal: 0 }]);
    expect(selectResult.affectedRows).toBeUndefined();

    const writeCtx = await connect(() => result([], { fields: [], affectedRows: 4 }));
    const writeResult = await writeCtx.adapter.executeQuery(writeCtx.session, "DELETE FROM users");
    expect(writeResult.affectedRows).toBe(4);
  });

  it("requires a schema for table operations", async () => {
    const { adapter, session } = await connect(() => result([]));
    await expect(adapter.listColumns(session, { name: "users" })).rejects.toThrow(/schema/i);
  });
});

describe("MySqlAdapter.testConnection", () => {
  it("returns ok when query succeeds", async () => {
    const adapter = new MySqlAdapter(
      "mysql",
      fakeFactory(() => result([{ "1": 1 }]))
    );
    expect((await adapter.testConnection(profile)).ok).toBe(true);
  });

  it("returns not ok when connecting fails", async () => {
    const adapter = new MySqlAdapter("mysql", () =>
      Promise.reject(new Error("ER_ACCESS_DENIED_ERROR"))
    );
    const r = await adapter.testConnection(profile);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("ER_ACCESS_DENIED_ERROR");
  });
});
