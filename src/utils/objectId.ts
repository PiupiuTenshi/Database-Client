import { randomUUID } from "node:crypto";

/** Sinh id duy nhất cho connection profile và các đối tượng nội bộ khác. */
export function newId(): string {
  return randomUUID();
}
