import { describe, it, expect } from "bun:test";
import { parseMedalBracketsCsv, parseHonorsCsv, parseJuryCsv } from "../csvImport";

describe("parseMedalBracketsCsv", () => {
  it("parses rows after the header and keeps line numbers", () => {
    const r = parseMedalBracketsCsv("Medal,Value,Low Limit,High Limit\nBronze,2,5,7\nGold,4,11,12\n");
    expect(r.errors).toEqual([]);
    expect(r.valid).toEqual([
      { line: 2, medalLabel: "Bronze", medalRank: 2, lowLimit: 5, highLimit: 7 },
      { line: 3, medalLabel: "Gold", medalRank: 4, lowLimit: 11, highLimit: 12 }
    ]);
  });
  it("reports column count, non-integer values, empty label and bad syntax with line numbers", () => {
    const r = parseMedalBracketsCsv("Bronze,2,5\nBronze,x,5,7\nBronze,2,-1,7\nBronze,2,5,7.5\n=cmd,2,5,7\n,2,5,7");
    expect(r.valid).toEqual([]);
    expect(r.errors.map((e) => e.line)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.errors[1].message).toBe("Value must be an integer");
  });
  it("rejects a duplicate Value in the file (second occurrence)", () => {
    const r = parseMedalBracketsCsv("Bronze,2,5,7\nBronze bis,2,8,9\nSilver,3,8,10");
    expect(r.valid.map((v) => v.line)).toEqual([1, 3]);
    expect(r.errors).toEqual([{ line: 2, message: "Duplicate Value 2 in file" }]);
  });
  it("is size and row limited like the other imports", () => {
    expect(parseMedalBracketsCsv("Medal,Value,Low Limit,High Limit\n" + "x".repeat(256 * 1024)).errors[0].line).toBe(0);
  });
});

describe("parseHonorsCsv", () => {
  it("accepts 2 or 3 columns; the order is optional", () => {
    const r = parseHonorsCsv("Code,Name,Order\nbop,Best Of Painter,3\nbos,Best Of Show\n");
    expect(r.errors).toEqual([]);
    expect(r.valid).toEqual([
      { line: 2, code: "bop", name: "Best Of Painter", sortOrder: 3 },
      { line: 3, code: "bos", name: "Best Of Show", sortOrder: null }
    ]);
  });
  it("rejects wrong column counts, bad order, empty cells and formulas", () => {
    const r = parseHonorsCsv("bop\n,Name\nbos,\nbs,Best,x\n=cmd,Name\nbs,Best,-2\nbs,Best,1,extra");
    expect(r.valid).toEqual([]);
    expect(r.errors.map((e) => e.line)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(r.errors[3].message).toBe("Order must be a non-negative integer");
  });
  it("rejects a code repeated in the file, case-insensitively", () => {
    const r = parseHonorsCsv("BOP,One\nbop,Two");
    expect(r.valid.map((v) => v.line)).toEqual([1]);
    expect(r.errors).toEqual([{ line: 2, message: 'Duplicate code "bop" in file' }]);
  });
});

describe("parseJuryCsv", () => {
  it("empty class = whole event; stand-in accepts 1/0/yes/no; email is lower-cased", () => {
    const r = parseJuryCsv("Judge Email,Class Number,Stand-in\nJudge@Example.com,,\nANNA@x.it,12,yes\nbob@x.it,13,No\ncarl@x.it,14,0\n");
    expect(r.errors).toEqual([]);
    expect(r.valid).toEqual([
      { line: 2, judgeEmail: "judge@example.com", classNumber: null, standingIn: false },
      { line: 3, judgeEmail: "anna@x.it", classNumber: "12", standingIn: true },
      { line: 4, judgeEmail: "bob@x.it", classNumber: "13", standingIn: false },
      { line: 5, judgeEmail: "carl@x.it", classNumber: "14", standingIn: false }
    ]);
  });
  it("rejects a stand-in without a class, an invalid flag or email and bad column counts", () => {
    const r = parseJuryCsv("a@x.it,,1\nb@x.it,12,maybe\nnot-an-email,12,0\n,12,0\nc@x.it,12\nd@x.it,12,0,extra");
    expect(r.valid).toEqual([]);
    expect(r.errors.map((e) => e.line)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(r.errors[0].message).toBe("Stand-in requires a Class Number");
    expect(r.errors[2].message).toBe("Judge Email is not valid");
  });
  it("rejects the same judge twice for the same class (or event) in the file", () => {
    const r = parseJuryCsv("a@x.it,12,0\nA@x.it,12,1\na@x.it,,0\na@x.it,13,0");
    expect(r.valid.map((v) => v.line)).toEqual([1, 3, 4]);
    expect(r.errors).toEqual([{ line: 2, message: "Duplicate assignment for a@x.it in class 12 in file" }]);
  });
});
