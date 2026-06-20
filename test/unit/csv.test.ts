import { describe, expect, it } from "vitest";
import { parseCsv } from "../../src/utils/csv";

describe("parseCsv", () => {
  it("parses headers and simple rows", () => {
    const result = parseCsv("id,name\n1,Ann\n2,Bob\n");
    expect(result.headers).toEqual(["id", "name"]);
    expect(result.rows).toEqual([
      ["1", "Ann"],
      ["2", "Bob"]
    ]);
  });

  it("handles quoted fields with commas, quotes and newlines", () => {
    const result = parseCsv('id,note\r\n1,"a,b"\r\n2,"line1\nline2"\r\n3,"say ""hi"""');
    expect(result.rows).toEqual([
      ["1", "a,b"],
      ["2", "line1\nline2"],
      ["3", 'say "hi"']
    ]);
  });

  it("strips a leading BOM", () => {
    const result = parseCsv("﻿id,name\n1,Ann");
    expect(result.headers).toEqual(["id", "name"]);
  });

  it("handles a file without trailing newline", () => {
    const result = parseCsv("a,b\n1,2");
    expect(result.rows).toEqual([["1", "2"]]);
  });
});
