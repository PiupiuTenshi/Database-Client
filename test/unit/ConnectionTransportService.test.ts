import { describe, expect, it } from "vitest";
import type { ConnectionProfile } from "../../src/core/types";
import {
  buildTransportPlan,
  usesAdvancedTransport,
  validateTransportProfile
} from "../../src/services/ConnectionTransportService";

function profile(overrides: Partial<ConnectionProfile> = {}): ConnectionProfile {
  return {
    id: "p1",
    name: "Postgres",
    dbType: "postgresql",
    host: "db.internal",
    port: 5432,
    database: "app",
    environment: "dev",
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("ConnectionTransportService", () => {
  it("keeps direct connections unchanged", () => {
    const plan = buildTransportPlan(profile());

    expect(plan.mode).toBe("direct");
    expect(plan.endpoint).toMatchObject({ host: "db.internal", port: 5432 });
    expect(plan.warnings).toEqual([]);
    expect(usesAdvancedTransport(profile())).toBe(false);
  });

  it("routes SSH tunnel profiles through the local endpoint", () => {
    const plan = buildTransportPlan(
      profile({
        sshTunnel: {
          enabled: true,
          host: "bastion.internal",
          username: "deploy",
          localPort: 15432
        }
      })
    );

    expect(plan.mode).toBe("ssh");
    expect(plan.endpoint).toMatchObject({ host: "127.0.0.1", port: 15432 });
    expect(plan.sshTunnel).toMatchObject({
      host: "bastion.internal",
      port: 22,
      remoteHost: "db.internal",
      remotePort: 5432
    });
    expect(plan.warnings).toEqual([]);
  });

  it("reports composite transport when proxy and Docker discovery are both enabled", () => {
    const plan = buildTransportPlan(
      profile({
        proxy: { enabled: true, protocol: "socks", host: "127.0.0.1", port: 1080 },
        docker: { enabled: true, service: "postgres" }
      })
    );

    expect(plan.mode).toBe("composite");
    expect(plan.proxy?.protocol).toBe("socks");
    expect(plan.docker?.service).toBe("postgres");
    expect(usesAdvancedTransport(planProfileWithProxy())).toBe(true);
  });

  it("validates required transport fields", () => {
    const warnings = validateTransportProfile(
      profile({
        host: undefined,
        port: undefined,
        sshTunnel: { enabled: true },
        proxy: { enabled: true, protocol: "http" },
        docker: { enabled: true },
        jdbc: { enabled: true }
      })
    );

    expect(warnings).toEqual([
      "SSH tunnel host is required.",
      "SSH tunnel username is required.",
      "SSH tunnel remote host is required.",
      "SSH tunnel remote port is required.",
      "Proxy host is required.",
      "Proxy port is required.",
      "Docker discovery needs a container name, compose project, or service.",
      "JDBC URL is required.",
      "JDBC driver class is required."
    ]);
  });
});

function planProfileWithProxy(): ConnectionProfile {
  return profile({ proxy: { enabled: true, protocol: "socks", host: "127.0.0.1", port: 1080 } });
}
