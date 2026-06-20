import type { ConnectionProfile } from "../core/types";

/** Một thao tác ghi có thể cần xác nhận trên môi trường production. */
export type WriteAction = "update" | "insert" | "delete" | "ddl" | "execute";

/** Connection có phải production không (dùng cho guard ghi/DDL). */
export function isProduction(profile: ConnectionProfile): boolean {
  return profile.environment === "production";
}

const ACTION_LABEL: Record<WriteAction, string> = {
  update: "update a row",
  insert: "insert a row",
  delete: "delete a row",
  ddl: "run a schema change (DDL)",
  execute: "run a write statement"
};

/**
 * Thông điệp cảnh báo khi ghi lên connection production. UI dùng để hiện modal
 * confirm trước khi thực thi. Trả undefined nếu không cần xác nhận.
 */
export function productionWriteWarning(
  profile: ConnectionProfile,
  action: WriteAction
): string | undefined {
  if (!isProduction(profile)) {
    return undefined;
  }
  return `"${profile.name}" is marked as a PRODUCTION connection. You are about to ${ACTION_LABEL[action]}. This change is applied immediately. Continue?`;
}
