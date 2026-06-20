import { EXTENSION_DISPLAY_NAME } from "./constants";

export function getHelloWorldMessage(): string {
  return `${EXTENSION_DISPLAY_NAME} is ready. Phase 0 project setup complete.`;
}

export function getConnectionSavedMessage(name: string): string {
  return `Saved connection "${name}".`;
}

export function getConnectionRemovedMessage(name: string): string {
  return `Removed connection "${name}".`;
}

export function getDeleteConnectionConfirm(name: string): string {
  return `Delete connection "${name}"? This cannot be undone.`;
}

export const DELETE_CONFIRM_ACTION = "Delete";

/** Text status bar item theo số lượng connection hiện có. */
export function getStatusBarText(connectionCount: number): string {
  return `$(database) DB Nexus (${connectionCount})`;
}

export function getStatusBarTooltip(connectionCount: number): string {
  const noun = connectionCount === 1 ? "connection" : "connections";
  return `${EXTENSION_DISPLAY_NAME}: ${connectionCount} ${noun}. Click to add a connection.`;
}
