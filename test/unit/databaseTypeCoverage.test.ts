import { describe, expect, it, vi } from "vitest";
import { AdapterRegistry } from "../../src/adapters/AdapterRegistry";
import { registerDefaultAdapters } from "../../src/adapters/registerDefaultAdapters";
import { DB_TYPE_OPTIONS, DEFAULT_DB_PORTS } from "../../src/core/constants";
import type { ConnectionDraft } from "../../src/core/types";
import { ConnectionService, type Logger } from "../../src/services/ConnectionService";
import { ProfileStore } from "../../src/storage/ProfileStore";
import { SecretStore } from "../../src/storage/SecretStore";
import { FakeMemento, FakeSecretStorage } from "../fakes/vscodeStorage";

function makeConnectionService(): ConnectionService {
  const logger: Logger = { info: vi.fn(), error: vi.fn() };
  return new ConnectionService(
    new ProfileStore(new FakeMemento()),
    new SecretStore(new FakeSecretStorage()),
    logger
  );
}

describe("database type coverage", () => {
  it("registers an adapter for every database type shown in the connection form", () => {
    const registry = new AdapterRegistry();
    registerDefaultAdapters(registry);

    for (const option of DB_TYPE_OPTIONS) {
      expect(registry.has(option.value), option.label).toBe(true);
      expect(registry.get(option.value)?.dbType).toBe(option.value);
    }
  });

  it("keeps database type values unique", () => {
    const values = DB_TYPE_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("accepts a valid draft shape for every database type", () => {
    const service = makeConnectionService();

    for (const option of DB_TYPE_OPTIONS) {
      const draft: ConnectionDraft = {
        name: `${option.label} test`,
        dbType: option.value,
        environment: "local",
        tags: [],
        ...(option.fileBased
          ? { filePath: "C:\\data\\test.db" }
          : { host: "127.0.0.1", port: 1234 })
      };

      expect(service.testConnection(draft), option.label).toMatchObject({ ok: true });
    }
  });

  it("defines a default port for every non-file database type", () => {
    for (const option of DB_TYPE_OPTIONS) {
      if (option.fileBased) {
        expect(DEFAULT_DB_PORTS[option.value], option.label).toBeUndefined();
      } else {
        expect(DEFAULT_DB_PORTS[option.value], option.label).toBeGreaterThan(0);
      }
    }
  });
});
