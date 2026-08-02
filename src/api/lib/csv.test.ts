import { describe, it, expect } from "vitest";
import { csvCell } from "./csv";

describe("csvCell", () => {
  it("returns empty string for null", () => expect(csvCell(null)).toBe(""));
  it("returns empty string for undefined", () =>
    expect(csvCell(undefined)).toBe(""));
  it("returns bare number string", () => expect(csvCell(42.5)).toBe("42.5"));
  it("wraps plain strings in double-quotes", () =>
    expect(csvCell("hello")).toBe('"hello"'));
  it("escapes embedded double-quotes", () =>
    expect(csvCell('say "hi"')).toBe('"say ""hi"""'));
  it("neutralises = formula injection", () =>
    expect(csvCell("=SUM(A1)")).toBe(`"'=SUM(A1)"`));
  it("neutralises + formula injection", () =>
    expect(csvCell("+1")).toBe(`"'+1"`));
  it("neutralises - formula injection", () =>
    expect(csvCell("-1+2")).toBe(`"'-1+2"`));
  it("neutralises @ formula injection", () =>
    expect(csvCell("@SUM")).toBe(`"'@SUM"`));
  it("replaces embedded newlines with space", () =>
    expect(csvCell("line1\nline2")).toBe('"line1 line2"'));
  it("replaces embedded CRLF with space", () =>
    expect(csvCell("line1\r\nline2")).toBe('"line1 line2"'));
});
