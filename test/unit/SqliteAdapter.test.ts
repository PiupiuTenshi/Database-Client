import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SqliteAdapter } from "../../src/adapters/sqlite/SqliteAdapter";
import type { DbSession } from "../../src/adapters/DatabaseAdapter";
import type { RuntimeConnectionProfile } from "../../src/core/types";

function profile(filePath: string): RuntimeConnectionProfile {
  return {
    id: "t",
    name: "test",
    dbType: "sqlite",
    filePath,
    environment: "local",
    tags: [],
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z"
  };
}

describe("SqliteAdapter (in-memory)", () => {
  let adapter: SqliteAdapter;
  let session: DbSession;

  beforeEach(async () => {
    adapter = new SqliteAdapter();
    session = await adapter.connect(profile(":memory:"));
    await adapter.executeQuery(
      session,
      "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)"
    );
    await adapter.executeQuery(
      session,
      "CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), title TEXT)"
    );
    await adapter.executeQuery(session, "CREATE INDEX idx_posts_user ON posts(user_id)");
    await adapter.executeQuery(session, "CREATE VIEW v_users AS SELECT id FROM users");
    await adapter.executeQuery(session, "INSERT INTO users (name) VALUES ('a'), ('b'), ('c')");
  });

  afterEach(async () => {
    await adapter.disconnect(session);
  });

  it("lists tables and views separately", async () => {
    const tables = await adapter.listTables(session);
    expect(tables.map((t) => t.name)).toEqual(["posts", "users"]);
    expect(tables.every((t) => t.type === "base_table")).toBe(true);

    const views = await adapter.listViews(session);
    expect(views.map((v) => v.name)).toEqual(["v_users"]);
    expect(views[0].type).toBe("view");
  });

  it("lists columns with pk/nullable info", async () => {
    const columns = await adapter.listColumns(session, { name: "users" });
    expect(columns.map((c) => c.name)).toEqual(["id", "name"]);
    expect(columns[0].isPrimaryKey).toBe(true);
    expect(columns[1].nullable).toBe(false);
    expect(columns[1].dataType).toBe("TEXT");
  });

  it("lists indexes", async () => {
    const indexes = await adapter.listIndexes(session, { name: "posts" });
    const idx = indexes.find((i) => i.name === "idx_posts_user");
    expect(idx).toBeDefined();
    expect(idx?.columns).toEqual(["user_id"]);
  });

  it("normalizes foreign keys", async () => {
    const fks = await adapter.listForeignKeys(session, { name: "posts" });
    expect(fks).toHaveLength(1);
    expect(fks[0].source.table).toBe("posts");
    expect(fks[0].source.columns).toEqual(["user_id"]);
    expect(fks[0].target.table).toBe("users");
    expect(fks[0].target.columns).toEqual(["id"]);
  });

  it("lists triggers on a table", async () => {
    await adapter.executeQuery(
      session,
      "CREATE TRIGGER trg_users AFTER INSERT ON users BEGIN SELECT 1; END"
    );
    const triggers = await adapter.listTriggers(session, { name: "users" });
    expect(triggers.map((t) => t.name)).toEqual(["trg_users"]);
    expect(triggers[0].statement).toContain("AFTER INSERT");
  });

  it("extracts named check constraints from DDL", async () => {
    await adapter.executeQuery(
      session,
      "CREATE TABLE acct (id INTEGER PRIMARY KEY, bal INTEGER, CONSTRAINT chk_pos CHECK (bal >= 0))"
    );
    const checks = await adapter.listCheckConstraints(session, { name: "acct" });
    expect(checks.map((c) => c.name)).toContain("chk_pos");
    expect(checks.find((c) => c.name === "chk_pos")?.expression).toContain("bal >= 0");
  });

  it("writes via parameterized query (params binding)", async () => {
    await adapter.executeQuery(session, "INSERT INTO users (name) VALUES (?)", {
      params: ["param-name"]
    });
    const result = await adapter.executeQuery(session, "SELECT name FROM users WHERE name = ?", {
      params: ["param-name"]
    });
    expect(result.rows).toHaveLength(1);
  });

  it("returns DDL for an object", async () => {
    const ddl = await adapter.getObjectDDL(session, { name: "users" });
    expect(ddl).toContain("CREATE TABLE");
    expect(ddl).toContain("users");
  });

  it("executes a SELECT and returns columns + rows", async () => {
    const result = await adapter.executeQuery(session, "SELECT * FROM users ORDER BY id");
    expect(result.columns.map((c) => c.name)).toEqual(["id", "name"]);
    expect(result.rows).toHaveLength(3);
    expect(result.rowCount).toBe(3);
    expect(result.truncated).toBe(false);
  });

  it("truncates rows when maxRows is set", async () => {
    const result = await adapter.executeQuery(session, "SELECT * FROM users", { maxRows: 2 });
    expect(result.rows).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });

  it("reports affectedRows for writes", async () => {
    const result = await adapter.executeQuery(session, "UPDATE users SET name = 'x' WHERE id = 1");
    expect(result.affectedRows).toBe(1);
    expect(result.rows).toHaveLength(0);
  });
});

describe("SqliteAdapter.testConnection", () => {
  it("succeeds for an in-memory database", async () => {
    const adapter = new SqliteAdapter();
    const result = await adapter.testConnection(profile(":memory:"));
    expect(result.ok).toBe(true);
  });

  it("fails for a missing file path", async () => {
    const adapter = new SqliteAdapter();
    const result = await adapter.testConnection(profile(""));
    expect(result.ok).toBe(false);
  });

  it("fails for a non-existent file", async () => {
    const adapter = new SqliteAdapter();
    const result = await adapter.testConnection(
      profile("/no/such/directory/definitely-missing.sqlite")
    );
    expect(result.ok).toBe(false);
  });
});
