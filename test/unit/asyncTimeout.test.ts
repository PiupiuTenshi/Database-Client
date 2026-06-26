import { describe, expect, it } from "vitest";
import { withTimeout } from "../../src/utils/asyncTimeout";

describe("withTimeout", () => {
  it("returns the value when the promise resolves before the timeout", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 1000, "too slow")).resolves.toBe("ok");
  });

  it("rejects when the promise does not resolve before the timeout", async () => {
    await expect(
      withTimeout(new Promise(() => undefined), 1, "metadata timed out")
    ).rejects.toThrow("metadata timed out");
  });

  it("does not apply a timeout when timeoutMs is zero", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 0, "too slow")).resolves.toBe("ok");
  });
});
