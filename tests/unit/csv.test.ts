import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("adds a BOM, quotes commas/quotes/newlines, keeps Hebrew", () => {
    const out = toCsv(
      ["שם", "הערה"],
      [
        ["מטפל, א", 'אמר "שלום"'],
        ["ב", null],
      ],
    );
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out).toContain('"מטפל, א","אמר ""שלום"""');
    expect(out.trim().split("\r\n")).toHaveLength(3);
  });
});
