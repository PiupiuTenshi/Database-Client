import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionService } from "../../src/services/ConnectionService";

describe("ConnectionService", () => {
  let service: ConnectionService;

  beforeEach(() => {
    service = new ConnectionService();
  });

  it("starts empty", () => {
    expect(service.listProfiles()).toEqual([]);
  });

  it("adds a mock profile with a unique id and fires change event", () => {
    const onChange = vi.fn();
    service.onDidChangeProfiles(onChange);

    const a = service.addMockProfile("DB A");
    const b = service.addMockProfile("DB B", "postgresql");

    expect(a.id).not.toBe(b.id);
    expect(b.driver).toBe("postgresql");
    expect(service.listProfiles()).toHaveLength(2);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("looks up a profile by id", () => {
    const profile = service.addMockProfile("DB A");
    expect(service.getProfile(profile.id)).toEqual(profile);
    expect(service.getProfile("missing")).toBeUndefined();
  });

  it("removes a profile and reports whether something was removed", () => {
    const profile = service.addMockProfile("DB A");
    const onChange = vi.fn();
    service.onDidChangeProfiles(onChange);

    expect(service.removeProfile(profile.id)).toBe(true);
    expect(service.removeProfile(profile.id)).toBe(false);
    expect(service.listProfiles()).toEqual([]);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("seeds mock profiles only once", () => {
    service.seedMockProfiles();
    const seededCount = service.listProfiles().length;
    expect(seededCount).toBeGreaterThan(0);

    service.seedMockProfiles();
    expect(service.listProfiles()).toHaveLength(seededCount);
  });
});
