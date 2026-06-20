import { describe, expect, it } from "vitest";
import {
  SqlServerAdapter,
  type MssqlClient,
  type MssqlClientFactory,
  type MssqlQueryResult
} from "../../src/adapters/sqlserver/SqlServerAdapter";
import type { DbSession } from "../../src/adapters/DatabaseAdapter";
import type { RuntimeConnectionProfile } from "../../src/core/types";

type Router = (text: string) => MssqlQueryResult;

function result(
  rows: Record<string, unknown>[],
  extra: Partial<MssqlQueryResult> = {}
): MssqlQueryResult {
  return {
    rows,
    columns: extra.columns ?? Object.keys(rows[0] ?? {}),
    rowsAffected: extra.rowsAffected ?? 0
  };
}

function fakeFactory(router: Router): MssqlClientFactory {
  return () => {
    const client: MssqlClient = {
      query: (text) => Promise.resolve(router(text)),
      end: () => Promise.resolve()
    };
    return Promise.resolve(client);
  };
}

const profile: RuntimeConnectionProfile = {
  id: "s",
  name: "mssql",
  dbType: "sqlserver",
  host: "localhost",
  port: 1433,
  username: "sa",
  password: "Strong!Passw0rd",
  database: "app_db",
  environment: "local",
  tags: [],
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-06-20T00:00:00.000Z"
};

async function connect(router: Router): Promise<{ adapter: SqlServerAdapter; session: DbSession }> {
  const adapter = new SqlServerAdapter(fakeFactory(router));
  const session = await adapter.connect(profile);
  return { adapter, session };
}

describe("SqlServerAdapter (mocked driver)", () => {
  it("uses bracket quoting and offset-fetch pagination", () => {
    const adapter = new SqlServerAdapter();
    expect(adapter.quoteIdentifier("we]ird")).toBe("[we]]ird]");
    expect(adapter.paginationStyle).toBe("offset-fetch");
  });

  it("lists schemas and flags dbo as default", async () => {
    const { adapter, session } = await connect((text) =>
      text.includes("sys.schemas") ? result([{ name: "dbo" }, { name: "sales" }]) : result([])
    );
    const schemas = await adapter.listSchemas(session);
    expect(schemas).toEqual([
      { name: "dbo", isDefault: true },
      { name: "sales", isDefault: false }
    ]);
  });

  it("lists tables for a schema", async () => {
    const { adapter, session } = await connect((text) =>
      text.includes("BASE TABLE") ? result([{ name: "users" }]) : result([])
    );
    const tables = await adapter.listTables(session, "dbo");
    expect(tables).toEqual([{ name: "users", schema: "dbo", type: "base_table" }]);
  });

  it("lists columns with primary key flags", async () => {
    const { adapter, session } = await connect((text) => {
      if (text.includes("INFORMATION_SCHEMA.COLUMNS")) {
        return result([
          {
            column_name: "id",
            data_type: "int",
            ordinal_position: 1,
            is_nullable: "NO",
            column_default: null
          },
          {
            column_name: "name",
            data_type: "nvarchar",
            ordinal_position: 2,
            is_nullable: "YES",
            column_default: null
          }
        ]);
      }
      if (text.includes("PRIMARY KEY")) {
        return result([{ column_name: "id" }]);
      }
      return result([]);
    });
    const columns = await adapter.listColumns(session, { schema: "dbo", name: "users" });
    expect(columns[0]).toMatchObject({ name: "id", isPrimaryKey: true, nullable: false });
    expect(columns[1].isPrimaryKey).toBe(false);
  });

  it("groups foreign keys", async () => {
    const { adapter, session } = await connect((text) =>
      text.includes("sys.foreign_keys")
        ? result([
            {
              constraint_name: "FK_orders_users",
              source_column: "user_id",
              target_table: "users",
              target_column: "id",
              update_rule: "NO_ACTION",
              delete_rule: "CASCADE"
            }
          ])
        : result([])
    );
    const fks = await adapter.listForeignKeys(session, { schema: "dbo", name: "orders" });
    expect(fks[0]).toMatchObject({
      name: "FK_orders_users",
      onDelete: "CASCADE",
      source: { schema: "dbo", table: "orders", columns: ["user_id"] },
      target: { table: "users", columns: ["id"] }
    });
  });

  it("lists view dependencies", async () => {
    const { adapter, session } = await connect((text) =>
      text.includes("VIEW_TABLE_USAGE")
        ? result([{ table_schema: "dbo", table_name: "orders" }])
        : result([])
    );
    const refs = await adapter.listViewDependencies(session, { schema: "dbo", name: "v_orders" });
    expect(refs).toEqual([{ schema: "dbo", name: "orders" }]);
  });

  it("returns object definition as DDL when available", async () => {
    const { adapter, session } = await connect((text) =>
      text.includes("OBJECT_DEFINITION")
        ? result([{ def: "CREATE VIEW dbo.v AS SELECT 1" }])
        : result([])
    );
    const ddl = await adapter.getObjectDDL(session, { schema: "dbo", name: "v" });
    expect(ddl).toContain("CREATE VIEW");
  });

  it("maps SELECT vs write results", async () => {
    const selectCtx = await connect(() => result([{ id: 1 }], { columns: ["id"] }));
    const selectResult = await selectCtx.adapter.executeQuery(selectCtx.session, "SELECT 1");
    expect(selectResult.columns).toEqual([{ name: "id", ordinal: 0 }]);
    expect(selectResult.affectedRows).toBeUndefined();

    const writeCtx = await connect(() => result([], { columns: [], rowsAffected: 7 }));
    const writeResult = await writeCtx.adapter.executeQuery(writeCtx.session, "DELETE FROM x");
    expect(writeResult.affectedRows).toBe(7);
  });
});

describe("SqlServerAdapter.testConnection", () => {
  it("returns ok when query succeeds", async () => {
    const adapter = new SqlServerAdapter(fakeFactory(() => result([{ ok: 1 }])));
    expect((await adapter.testConnection(profile)).ok).toBe(true);
  });

  it("returns not ok when connect fails", async () => {
    const adapter = new SqlServerAdapter(() => Promise.reject(new Error("ELOGIN")));
    const r = await adapter.testConnection(profile);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("ELOGIN");
  });
});
