import { EXTENSION_DISPLAY_NAME } from "./constants";

export function getHelloWorldMessage(): string {
  return `${EXTENSION_DISPLAY_NAME} is ready. Phase 0 project setup complete.`;
}

export function getConnectionAddedMessage(name: string): string {
  return `Added mock connection "${name}".`;
}

export function getConnectionRemovedMessage(name: string): string {
  return `Removed connection "${name}".`;
}

/** Prompt cho ô nhập tên connection (Phase 1 — mock). */
export const ADD_CONNECTION_PROMPT = "Connection name (mock — Phase 1)";
export const ADD_CONNECTION_PLACEHOLDER = "My Database";

/** Label node con placeholder dưới mỗi connection cho tới khi schema explorer sẵn sàng. */
export const SCHEMA_PENDING_LABEL = "Schema explorer available in a later phase";

/** Text status bar item theo số lượng connection hiện có. */
export function getStatusBarText(connectionCount: number): string {
  return `$(database) DB Nexus (${connectionCount})`;
}

export function getStatusBarTooltip(connectionCount: number): string {
  const noun = connectionCount === 1 ? "connection" : "connections";
  return `${EXTENSION_DISPLAY_NAME}: ${connectionCount} ${noun}. Click to add a connection.`;
}
