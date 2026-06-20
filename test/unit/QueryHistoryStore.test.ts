import { beforeEach, describe, expect, it } from "vitest";
import { QueryHistoryStore } from "../../src/storage/QueryHistoryStore";
import type { QueryHistoryItem } from "../../src/core/types";
import { FakeMemento } from "../fakes/vscodeStorage";

function item(id: string): QueryHistoryItem {
  return {
    id,
    connectionId: "c1",
    connectionName: "C1",
    sql: `SELECT ${id}`,
    status: "success",
    createdAt: "2026-06-20T00:00:00.000Z"
  };
}

describe("QueryHistoryStore", () => {
  let store: QueryHistoryStore;

  beforeEach(() => {
    store = new QueryHistoryStore(new FakeMemento());
  });

  it("starts empty", () => {
    expect(store.list()).toEqual([]);
  });

  it("prepends newest item first", async () => {
    await store.add(item("1"));
    await store.add(item("2"));
    expect(store.list().map((entry) => entry.id)).toEqual(["2", "1"]);
  });

  it("respects the list limit", async () => {
    await store.add(item("1"));
    await store.add(item("2"));
    await store.add(item("3"));
    expect(store.list(2).map((entry) => entry.id)).toEqual(["3", "2"]);
  });

  it("clears history", async () => {
    await store.add(item("1"));
    await store.clear();
    expect(store.list()).toEqual([]);
  });
});
