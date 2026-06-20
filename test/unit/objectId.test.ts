import { describe, expect, it } from "vitest";
import { newId } from "../../src/utils/objectId";

describe("newId", () => {
  it("returns a uuid-shaped string", () => {
    expect(newId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("returns unique values", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId()));
    expect(ids.size).toBe(100);
  });
});
