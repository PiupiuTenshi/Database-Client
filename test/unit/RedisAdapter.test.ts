import { describe, expect, it } from "vitest";
import {
  RedisAdapter,
  type RedisClient,
  type RedisClientFactory
} from "../../src/adapters/redis/RedisAdapter";
import type { DbSession } from "../../src/adapters/DatabaseAdapter";
import type { RuntimeConnectionProfile } from "../../src/core/types";

const profile: RuntimeConnectionProfile = {
  id: "r",
  name: "redis",
  dbType: "redis",
  host: "localhost",
  port: 6379,
  environment: "local",
  tags: [],
  createdAt: "2026-06-20T00:00:00.000Z",
  updatedAt: "2026-06-20T00:00:00.000Z"
};

function fakeFactory(overrides: Partial<RedisClient>): RedisClientFactory {
  return () => {
    const client: RedisClient = {
      ping: () => Promise.resolve("PONG"),
      scan: () => Promise.resolve({ cursor: 0, keys: [] }),
      type: () => Promise.resolve("string"),
      sendCommand: () => Promise.resolve(null),
      quit: () => Promise.resolve(),
      ...overrides
    };
    return Promise.resolve(client);
  };
}

async function connect(overrides: Partial<RedisClient>): Promise<{
  adapter: RedisAdapter;
  session: DbSession;
}> {
  const adapter = new RedisAdapter(fakeFactory(overrides));
  const session = await adapter.connect(profile);
  return { adapter, session };
}

describe("RedisAdapter", () => {
  it("tests connection via PING", async () => {
    const adapter = new RedisAdapter(fakeFactory({}));
    expect((await adapter.testConnection(profile)).ok).toBe(true);
  });

  it("reports failure when connecting throws", async () => {
    const adapter = new RedisAdapter(() => Promise.reject(new Error("ECONNREFUSED")));
    const r = await adapter.testConnection(profile);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("ECONNREFUSED");
  });

  it("lists keys as tables via SCAN", async () => {
    const { adapter, session } = await connect({
      scan: () => Promise.resolve({ cursor: 0, keys: ["user:1", "user:2"] })
    });
    const tables = await adapter.listTables(session);
    expect(tables).toEqual([
      { name: "user:1", type: "base_table" },
      { name: "user:2", type: "base_table" }
    ]);
  });

  it("has no schemas / columns / foreign keys", async () => {
    const { adapter, session } = await connect({});
    expect(await adapter.listSchemas(session)).toEqual([]);
    expect(await adapter.listColumns(session, { name: "k" })).toEqual([]);
    expect(await adapter.listForeignKeys(session, { name: "k" })).toEqual([]);
  });

  it("runs a scalar command", async () => {
    const { adapter, session } = await connect({
      sendCommand: (args) => Promise.resolve(args.join(":") === "GET:foo" ? "bar" : null)
    });
    const result = await adapter.executeQuery(session, "GET foo");
    expect(result.columns).toEqual([{ name: "result", ordinal: 0 }]);
    expect(result.rows).toEqual([{ result: "bar" }]);
  });

  it("runs an array command", async () => {
    const { adapter, session } = await connect({
      sendCommand: () => Promise.resolve(["a", "b", "c"])
    });
    const result = await adapter.executeQuery(session, "KEYS *");
    expect(result.columns).toEqual([{ name: "value", ordinal: 0 }]);
    expect(result.rows).toEqual([{ value: "a" }, { value: "b" }, { value: "c" }]);
  });

  it("maps a nil reply to no rows", async () => {
    const { adapter, session } = await connect({ sendCommand: () => Promise.resolve(null) });
    const result = await adapter.executeQuery(session, "GET missing");
    expect(result.rows).toEqual([]);
  });

  it("truncates array replies by maxRows", async () => {
    const { adapter, session } = await connect({
      sendCommand: () => Promise.resolve(["a", "b", "c"])
    });
    const result = await adapter.executeQuery(session, "KEYS *", { maxRows: 2 });
    expect(result.rows).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });

  it("rejects an empty command", async () => {
    const { adapter, session } = await connect({});
    await expect(adapter.executeQuery(session, "   ")).rejects.toThrow(/empty/i);
  });
});
