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

  it("toggles and searches favorites", async () => {
    await store.add(item("1"));
    await store.add(item("2"));
    await store.toggleFavorite("1");
    expect(store.search(undefined, true).map((e) => e.id)).toEqual(["1"]);
    expect(store.search("SELECT 2").map((e) => e.id)).toEqual(["2"]);
  });

  it("keeps favorites beyond the retention limit", async () => {
    const small = new QueryHistoryStore(new FakeMemento(), () => 2);
    await small.add(item("1"));
    await small.toggleFavorite("1");
    await small.add(item("2"));
    await small.add(item("3"));
    await small.add(item("4"));
    // limit 2 non-favorites (4,3) + favorite (1) survive; 2 is dropped
    expect(
      small
        .list()
        .map((e) => e.id)
        .sort()
    ).toEqual(["1", "3", "4"]);
  });

  it("removes one item and clears by connection", async () => {
    await store.add({ ...item("1"), connectionId: "a" });
    await store.add({ ...item("2"), connectionId: "b" });
    await store.remove("1");
    expect(store.list().map((e) => e.id)).toEqual(["2"]);
    await store.clearForConnection("b");
    expect(store.list()).toEqual([]);
  });
});
