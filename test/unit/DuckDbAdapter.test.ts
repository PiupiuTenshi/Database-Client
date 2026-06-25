import { describe, expect, it } from "vitest";
import {
  DuckDbAdapter,
  type DuckDbConnection,
  type DuckDbDatabase,
  type DuckDbResultReader
} from "../../src/adapters/duckdb/DuckDbAdapter";

class FakeDuckReader implements DuckDbResultReader {
  constructor(private readonly rows: Record<string, unknown>[]) {}

  columnNames(): string[] {
    return Object.keys(this.rows[0] ?? {});
  }

  getRowObjectsJS(): Record<string, unknown>[] {
    return this.rows;
  }
}

class FakeDuckConnection implements DuckDbConnection {
  closeSync(): void {}

  async runAndReadAll(sql: string): Promise<DuckDbResultReader> {
    if (sql.includes("information_schema.tables")) {
      return new FakeDuckReader([{ table_name: "events" }]);
    }
    if (sql.includes("information_schema.columns")) {
      return new FakeDuckReader([
        {
          column_name: "id",
          data_type: "INTEGER",
          ordinal_position: 1,
          is_nullable: "NO",
          column_default: null
        }
      ]);
    }
    if (sql.includes("table_constraints")) {
      return new FakeDuckReader([{ column_name: "id" }]);
    }
    return new FakeDuckReader([{ id: 1, name: "alpha" }]);
  }
}

class FakeDuckDatabase implements DuckDbDatabase {
  readonly connection = new FakeDuckConnection();
  async connect(): Promise<DuckDbConnection> {
    return this.connection;
  }
  closeSync(): void {}
}

describe("DuckDbAdapter", () => {
  it("lists tables and primary-key columns", async () => {
    const adapter = new DuckDbAdapter(async () => new FakeDuckDatabase());
    const session = await adapter.connect({
      id: "p1",
      name: "Duck",
      dbType: "duckdb",
      filePath: ":memory:",
      environment: "local",
      tags: [],
      createdAt: "",
      updatedAt: ""
    });

    await expect(adapter.listTables(session, "main")).resolves.toEqual([
      { name: "events", schema: "main", type: "base_table" }
    ]);
    await expect(adapter.listColumns(session, { schema: "main", name: "events" })).resolves.toEqual([
      {
        name: "id",
        dataType: "INTEGER",
        ordinal: 1,
        nullable: false,
        defaultValue: undefined,
        isPrimaryKey: true
      }
    ]);
  });

  it("maps query rows to result columns", async () => {
    const adapter = new DuckDbAdapter(async () => new FakeDuckDatabase());
    const session = await adapter.connect({
      id: "p1",
      name: "Duck",
      dbType: "duckdb",
      filePath: ":memory:",
      environment: "local",
      tags: [],
      createdAt: "",
      updatedAt: ""
    });
    const result = await adapter.executeQuery(session, "SELECT 1 AS id");
    expect(result.columns.map((column) => column.name)).toEqual(["id", "name"]);
    expect(result.rows).toEqual([{ id: 1, name: "alpha" }]);
  });
});
