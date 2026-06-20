import { describe, expect, it } from "vitest";
import { tokenizeCommand } from "../../src/utils/commandTokenizer";

describe("tokenizeCommand", () => {
  it("splits on whitespace", () => {
    expect(tokenizeCommand("GET foo")).toEqual(["GET", "foo"]);
    expect(tokenizeCommand("  KEYS   *  ")).toEqual(["KEYS", "*"]);
  });

  it("respects double and single quotes", () => {
    expect(tokenizeCommand('SET foo "hello world"')).toEqual(["SET", "foo", "hello world"]);
    expect(tokenizeCommand("SET foo 'a b'")).toEqual(["SET", "foo", "a b"]);
  });

  it("keeps empty quoted token", () => {
    expect(tokenizeCommand('SET foo ""')).toEqual(["SET", "foo", ""]);
  });

  it("returns empty array for blank input", () => {
    expect(tokenizeCommand("   ")).toEqual([]);
  });
});
