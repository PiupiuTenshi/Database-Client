import { beforeEach, describe, expect, it } from "vitest";
import { SecretStore } from "../../src/storage/SecretStore";
import { FakeSecretStorage } from "../fakes/vscodeStorage";

describe("SecretStore", () => {
  let secrets: FakeSecretStorage;
  let store: SecretStore;

  beforeEach(() => {
    secrets = new FakeSecretStorage();
    store = new SecretStore(secrets);
  });

  it("stores and retrieves a password under a namespaced key", async () => {
    await store.setPassword("conn-1", "s3cret");
    expect(secrets.has("openDbNexus.connection.conn-1.password")).toBe(true);
    expect(await store.getPassword("conn-1")).toBe("s3cret");
  });

  it("returns undefined for unknown connection", async () => {
    expect(await store.getPassword("missing")).toBeUndefined();
  });

  it("deletes a password", async () => {
    await store.setPassword("conn-1", "s3cret");
    await store.deletePassword("conn-1");
    expect(await store.getPassword("conn-1")).toBeUndefined();
  });
});
