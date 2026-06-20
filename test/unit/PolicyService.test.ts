import { describe, expect, it } from "vitest";
import type { ConnectionProfile } from "../../src/core/types";
import { PolicyService, type SecurityPolicy } from "../../src/services/PolicyService";

function profile(environment: ConnectionProfile["environment"]): ConnectionProfile {
  return {
    id: "1",
    name: "db",
    dbType: "postgresql",
    environment,
    tags: [],
    createdAt: "",
    updatedAt: ""
  };
}

function svc(policy: Partial<SecurityPolicy>): PolicyService {
  return new PolicyService(() => ({
    disableWriteOnProduction: false,
    disableExportOnProduction: false,
    maxRows: 1000,
    ...policy
  }));
}

describe("PolicyService", () => {
  it("blocks writes only on production when the policy is on", () => {
    const blocked = svc({ disableWriteOnProduction: true });
    expect(blocked.isWriteBlocked(profile("production"))).toBe(true);
    expect(blocked.isWriteBlocked(profile("local"))).toBe(false);
    expect(svc({}).isWriteBlocked(profile("production"))).toBe(false);
  });

  it("blocks exports only on production when the policy is on", () => {
    const blocked = svc({ disableExportOnProduction: true });
    expect(blocked.isExportBlocked(profile("production"))).toBe(true);
    expect(blocked.isExportBlocked(profile("staging"))).toBe(false);
  });

  it("throws a descriptive error when a write is blocked", () => {
    expect(() =>
      svc({ disableWriteOnProduction: true }).assertWriteAllowed(profile("production"))
    ).toThrow(/disabled by policy/);
    expect(() => svc({}).assertWriteAllowed(profile("production"))).not.toThrow();
  });

  it("exposes the configured maxRows", () => {
    expect(svc({ maxRows: 500 }).maxRows()).toBe(500);
  });
});
