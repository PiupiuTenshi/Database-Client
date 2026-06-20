import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionService, type Logger } from "../../src/services/ConnectionService";
import { ProfileStore } from "../../src/storage/ProfileStore";
import { SecretStore } from "../../src/storage/SecretStore";
import type { ConnectionDraft } from "../../src/core/types";
import { FakeMemento, FakeSecretStorage } from "../fakes/vscodeStorage";

const NOW = "2026-06-20T00:00:00.000Z";

function makeService() {
  const memento = new FakeMemento();
  const secrets = new FakeSecretStorage();
  const logger: Logger = { info: vi.fn(), error: vi.fn() };
  const service = new ConnectionService(
    new ProfileStore(memento),
    new SecretStore(secrets),
    logger,
    () => NOW
  );
  return { service, secrets, logger };
}

const sqliteDraft: ConnectionDraft = {
  name: "Local SQLite",
  dbType: "sqlite",
  environment: "local",
  filePath: "/tmp/app.sqlite",
  tags: ["demo", " "]
};

const pgDraft: ConnectionDraft = {
  name: "Local PG",
  dbType: "postgresql",
  environment: "dev",
  host: "localhost",
  port: 5432,
  username: "postgres",
  database: "app",
  tags: []
};

describe("ConnectionService", () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it("creates a profile with id/timestamps and trims tags", async () => {
    const onChange = vi.fn();
    ctx.service.onDidChangeProfiles(onChange);

    const profile = await ctx.service.createProfile(sqliteDraft);

    expect(profile.id).toBeTruthy();
    expect(profile.createdAt).toBe(NOW);
    expect(profile.updatedAt).toBe(NOW);
    expect(profile.tags).toEqual(["demo"]);
    expect(ctx.service.listProfiles()).toHaveLength(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("stores password in SecretStorage, never in the profile", async () => {
    const profile = await ctx.service.createProfile(pgDraft, "s3cret");

    expect(JSON.stringify(profile)).not.toContain("s3cret");
    expect(ctx.secrets.has(`openDbNexus.connection.${profile.id}.password`)).toBe(true);
  });

  it("updates a profile but keeps id/createdAt", async () => {
    const created = await ctx.service.createProfile(sqliteDraft);
    const updated = await ctx.service.updateProfile(created.id, {
      ...sqliteDraft,
      name: "Renamed"
    });

    expect(updated?.id).toBe(created.id);
    expect(updated?.createdAt).toBe(created.createdAt);
    expect(updated?.name).toBe("Renamed");
    expect(ctx.service.listProfiles()).toHaveLength(1);
  });

  it("returns undefined when updating a missing profile", async () => {
    expect(await ctx.service.updateProfile("nope", sqliteDraft)).toBeUndefined();
  });

  it("deletes a profile and its secret", async () => {
    const profile = await ctx.service.createProfile(pgDraft, "s3cret");
    const removed = await ctx.service.deleteProfile(profile.id);

    expect(removed).toBe(true);
    expect(ctx.service.listProfiles()).toEqual([]);
    expect(ctx.secrets.has(`openDbNexus.connection.${profile.id}.password`)).toBe(false);
  });

  describe("testConnection (mock)", () => {
    it("requires a name", () => {
      expect(ctx.service.testConnection({ ...pgDraft, name: "  " }).ok).toBe(false);
    });

    it("requires file path for file-based db", () => {
      const result = ctx.service.testConnection({ ...sqliteDraft, filePath: "" });
      expect(result.ok).toBe(false);
    });

    it("requires host for server db", () => {
      const result = ctx.service.testConnection({ ...pgDraft, host: "" });
      expect(result.ok).toBe(false);
    });

    it("passes when required fields are present", () => {
      expect(ctx.service.testConnection(sqliteDraft).ok).toBe(true);
      expect(ctx.service.testConnection(pgDraft).ok).toBe(true);
    });
  });
});
