import { beforeEach, describe, expect, it } from "vitest";
import { ProfileStore } from "../../src/storage/ProfileStore";
import type { ConnectionProfile } from "../../src/core/types";
import { FakeMemento } from "../fakes/vscodeStorage";

function makeProfile(id: string, name: string): ConnectionProfile {
  return {
    id,
    name,
    dbType: "sqlite",
    environment: "local",
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("ProfileStore", () => {
  let store: ProfileStore;

  beforeEach(() => {
    store = new ProfileStore(new FakeMemento());
  });

  it("starts empty", () => {
    expect(store.list()).toEqual([]);
  });

  it("saves new profiles and updates existing ones in place", async () => {
    await store.save(makeProfile("a", "A"));
    await store.save(makeProfile("b", "B"));
    expect(store.list()).toHaveLength(2);

    await store.save(makeProfile("a", "A renamed"));
    expect(store.list()).toHaveLength(2);
    expect(store.get("a")?.name).toBe("A renamed");
  });

  it("removes a profile and reports the result", async () => {
    await store.save(makeProfile("a", "A"));
    expect(await store.remove("a")).toBe(true);
    expect(await store.remove("a")).toBe(false);
    expect(store.list()).toEqual([]);
  });
});
