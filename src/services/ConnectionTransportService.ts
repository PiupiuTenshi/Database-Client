import type {
  ConnectionProfile,
  DockerDiscoveryConfig,
  JdbcBridgeConfig,
  ProxyConfig,
  SshTunnelConfig
} from "../core/types";

export type TransportMode = "direct" | "ssh" | "proxy" | "docker" | "jdbc" | "composite";

export interface ConnectionEndpoint {
  host?: string;
  port?: number;
  database?: string;
  filePath?: string;
}

export interface SshTunnelPlan extends Required<Pick<SshTunnelConfig, "enabled">> {
  host?: string;
  port: number;
  username?: string;
  privateKeyPath?: string;
  localHost: string;
  localPort?: number;
  remoteHost?: string;
  remotePort?: number;
}

export interface ProxyPlan extends Required<Pick<ProxyConfig, "enabled" | "protocol">> {
  host?: string;
  port?: number;
  username?: string;
}

export interface TransportPlan {
  mode: TransportMode;
  endpoint: ConnectionEndpoint;
  sshTunnel?: SshTunnelPlan;
  proxy?: ProxyPlan;
  docker?: DockerDiscoveryConfig;
  jdbc?: JdbcBridgeConfig;
  warnings: string[];
}

const DEFAULT_SSH_PORT = 22;
const DEFAULT_LOCAL_HOST = "127.0.0.1";

export function buildTransportPlan(profile: ConnectionProfile): TransportPlan {
  const endpoint: ConnectionEndpoint = {
    host: profile.host,
    port: profile.port,
    database: profile.database,
    filePath: profile.filePath
  };
  const plan: TransportPlan = {
    mode: "direct",
    endpoint,
    warnings: validateTransportProfile(profile)
  };
  const enabledModes: TransportMode[] = [];

  if (profile.sshTunnel?.enabled) {
    const tunnel = profile.sshTunnel;
    const remoteHost = tunnel.remoteHost ?? profile.host;
    const remotePort = tunnel.remotePort ?? profile.port;
    plan.sshTunnel = {
      enabled: true,
      host: tunnel.host,
      port: tunnel.port ?? DEFAULT_SSH_PORT,
      username: tunnel.username,
      privateKeyPath: tunnel.privateKeyPath,
      localHost: tunnel.localHost ?? DEFAULT_LOCAL_HOST,
      localPort: tunnel.localPort,
      remoteHost,
      remotePort
    };
    plan.endpoint.host = plan.sshTunnel.localHost;
    plan.endpoint.port = plan.sshTunnel.localPort ?? remotePort;
    if (!tunnel.localPort) {
      plan.warnings.push("SSH tunnel needs a runtime local port allocation before driver connect.");
    }
    enabledModes.push("ssh");
  }

  if (profile.proxy?.enabled) {
    plan.proxy = {
      enabled: true,
      protocol: profile.proxy.protocol,
      host: profile.proxy.host,
      port: profile.proxy.port,
      username: profile.proxy.username
    };
    enabledModes.push("proxy");
  }

  if (profile.docker?.enabled) {
    plan.docker = profile.docker;
    plan.warnings.push("Docker discovery is planned; explicit host/port are still used for now.");
    enabledModes.push("docker");
  }

  if (profile.jdbc?.enabled) {
    plan.jdbc = profile.jdbc;
    plan.warnings.push("JDBC bridge is planned; native adapters are still preferred when available.");
    enabledModes.push("jdbc");
  }

  plan.mode = resolveMode(enabledModes);
  return plan;
}

export function usesAdvancedTransport(profile: ConnectionProfile): boolean {
  return Boolean(
    profile.sshTunnel?.enabled ||
      profile.proxy?.enabled ||
      profile.docker?.enabled ||
      profile.jdbc?.enabled
  );
}

export function validateTransportProfile(profile: ConnectionProfile): string[] {
  const warnings: string[] = [];

  if (profile.sshTunnel?.enabled) {
    if (!profile.sshTunnel.host?.trim()) {
      warnings.push("SSH tunnel host is required.");
    }
    if (!profile.sshTunnel.username?.trim()) {
      warnings.push("SSH tunnel username is required.");
    }
    if (!profile.sshTunnel.remoteHost?.trim() && !profile.host?.trim()) {
      warnings.push("SSH tunnel remote host is required.");
    }
    if (!profile.sshTunnel.remotePort && !profile.port) {
      warnings.push("SSH tunnel remote port is required.");
    }
  }

  if (profile.proxy?.enabled) {
    if (!profile.proxy.host?.trim()) {
      warnings.push("Proxy host is required.");
    }
    if (!profile.proxy.port) {
      warnings.push("Proxy port is required.");
    }
  }

  if (profile.docker?.enabled) {
    const hasDockerTarget = Boolean(
      profile.docker.containerName?.trim() ||
        profile.docker.composeProject?.trim() ||
        profile.docker.service?.trim()
    );
    if (!hasDockerTarget) {
      warnings.push("Docker discovery needs a container name, compose project, or service.");
    }
  }

  if (profile.jdbc?.enabled) {
    if (!profile.jdbc.jdbcUrl?.trim()) {
      warnings.push("JDBC URL is required.");
    }
    if (!profile.jdbc.driverClass?.trim()) {
      warnings.push("JDBC driver class is required.");
    }
  }

  return warnings;
}

function resolveMode(enabledModes: TransportMode[]): TransportMode {
  if (enabledModes.length === 0) {
    return "direct";
  }
  if (enabledModes.length === 1) {
    return enabledModes[0];
  }
  return "composite";
}
