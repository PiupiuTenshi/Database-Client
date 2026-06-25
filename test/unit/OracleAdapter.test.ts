import { describe, expect, it } from "vitest";
import { OracleAdapter, type OracleConnectionLike, type OracleExecuteResult } from "../../src/adapters/oracle/OracleAdapter";

class FakeOracleConnection implements OracleConnectionLike {
  async execute(sql: string): Promise<OracleExecuteResult> {
    if (sql.includes("all_users")) {
      return { rows: [{ NAME: "APP" }], metaData: [{ name: "NAME" }] };
    }
    if (sql.includes("all_tables")) {
      return { rows: [{ OWNER: "APP", TABLE_NAME: "USERS" }] };
    }
    if (sql.includes("all_tab_columns")) {
      return {
        rows: [
          {
            COLUMN_NAME: "ID",
            DATA_TYPE: "NUMBER",
            COLUMN_ID: 1,
            NULLABLE: "N",
            DATA_DEFAULT: null
          }
        ]
      };
    }
    if (sql.includes("constraint_type = 'P'")) {
      return { rows: [{ COLUMN_NAME: "ID" }] };
    }
    return {
      rows: [{ ID: 1 }],
      metaData: [{ name: "ID", dbTypeName: "NUMBER" }],
      rowsAffected: 1
    };
  }

  async close(): Promise<void> {}
}

describe("OracleAdapter", () => {
  it("maps schema, table and primary-key column metadata", async () => {
    const adapter = new OracleAdapter(async () => new FakeOracleConnection());
    const session = await adapter.connect({
      id: "p1",
      name: "Oracle",
      dbType: "oracle",
      host: "localhost",
      database: "localhost:1521/XE",
      environment: "local",
      tags: [],
      createdAt: "",
      updatedAt: ""
    });

    await expect(adapter.listSchemas(session)).resolves.toEqual([{ name: "APP" }]);
    await expect(adapter.listTables(session, "APP")).resolves.toEqual([
      { schema: "APP", name: "USERS", type: "base_table" }
    ]);
    await expect(adapter.listColumns(session, { schema: "APP", name: "USERS" })).resolves.toEqual([
      {
        name: "ID",
        dataType: "NUMBER",
        ordinal: 1,
        nullable: false,
        defaultValue: undefined,
        isPrimaryKey: true
      }
    ]);
  });

  it("uses colon bind style and maps query rows", async () => {
    const adapter = new OracleAdapter(async () => new FakeOracleConnection());
    expect(adapter.placeholderStyle).toBe("colon");
    const session = await adapter.connect({
      id: "p1",
      name: "Oracle",
      dbType: "oracle",
      host: "localhost",
      database: "localhost:1521/XE",
      environment: "local",
      tags: [],
      createdAt: "",
      updatedAt: ""
    });
    const result = await adapter.executeQuery(session, "SELECT 1 AS id FROM dual");
    expect(result.columns).toEqual([{ name: "ID", dataType: "NUMBER", ordinal: 0 }]);
    expect(result.rows).toEqual([{ ID: 1 }]);
  });
});
