/**
 * Che giá trị nhạy cảm trước khi log. KHÔNG bao giờ log password/token thô.
 * "abcdef" -> "ab****ef", "abc" -> "****".
 */
export function maskSecret(value: string | undefined | null): string {
  if (!value) {
    return "";
  }
  if (value.length <= 4) {
    return "****";
  }
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}
