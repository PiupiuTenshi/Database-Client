import { describe, expect, it } from "vitest";
import { getHelloWorldMessage } from "../../src/core/messages";

describe("getHelloWorldMessage", () => {
  it("returns the Phase 0 readiness message", () => {
    expect(getHelloWorldMessage()).toBe(
      "Open DB Nexus is ready. Phase 0 project setup complete."
    );
  });
});
