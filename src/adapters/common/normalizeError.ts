import type { DbError } from "../../core/types";

interface DriverErrorLike {
  message?: unknown;
  code?: unknown;
}

/**
 * Chuẩn hóa lỗi driver thành DbError gọn. Không giữ stack dài;
 * UI có thể hiển thị message + code.
 */
export function normalizeError(error: unknown): DbError {
  if (error instanceof Error) {
    const code = (error as DriverErrorLike).code;
    return {
      message: error.message,
      code: typeof code === "string" ? code : undefined
    };
  }
  if (typeof error === "object" && error !== null) {
    const like = error as DriverErrorLike;
    return {
      message: typeof like.message === "string" ? like.message : JSON.stringify(error),
      code: typeof like.code === "string" ? like.code : undefined
    };
  }
  return { message: String(error) };
}
