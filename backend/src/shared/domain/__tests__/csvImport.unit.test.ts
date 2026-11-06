import { describe, it, expect } from "bun:test";
import { parseCsv, parseLevelsCsv, parseClassesCsv, CSV_MAX_BYTES, CSV_MAX_ROWS } from "../csvImport";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF, BOM and blank lines", () => {
    const { rows } = parseCsv('﻿a,"b,1","c ""x"""\r\n\r\nd,e,f\n');
    expect(rows).toEqual([
      { line: 1, cells: ["a", "b,1", 'c "x"'] },
      { line: 3, cells: ["d", "e", "f"] }
    ]);
  });
  it("reports unterminated quotes", () => {
    expect(parseCsv('a,"b').error).toBeDefined();
  });
});

describe("parseLevelsCsv", () => {
  it("accepts header, parses flags, reports bad rows with line numbers", () => {
    const r = parseLevelsCsv("Level Name,Free To Enter(1/0)\nNovice,1\nOpen,0\nBad,2\n=cmd,1\nnovice,0\nOnlyOne\n");
    expect(r.valid).toEqual([
      { line: 2, name: "Novice", freeToEnter: true },
      { line: 3, name: "Open", freeToEnter: false }
    ]);
    expect(r.errors.map((e) => e.line)).toEqual([4, 5, 6, 7]);
  });
  it("rejects formulas and HTML", () => {
    const r = parseLevelsCsv('@SUM(1),1\n"<b>x</b>",1\n-1,0\n+1,0');
    expect(r.valid).toHaveLength(0);
    expect(r.errors).toHaveLength(4);
  });
  it("enforces size and row limits", () => {
    expect(parseLevelsCsv("a".repeat(CSV_MAX_BYTES + 1)).errors[0].line).toBe(0);
    const many = Array.from({ length: CSV_MAX_ROWS + 5 }, (_, i) => `L${i},1`).join("\n");
    expect(parseLevelsCsv(many).errors[0].message).toContain("Too many rows");
  });
});

describe("parseClassesCsv", () => {
  it("parses valid rows and validates order/flags/columns", () => {
    const r = parseClassesCsv(
      "Class Number,Level Name,Class Name,Category,Presentation Order Number,Out Of Competition(1/0)\n" +
      "101,Novice,Tanks,Vehicles,3,0\n102,Open,Planes,Air,x,0\n103,Open,Ships,Sea,1,5\n104,Open\n105,Open,Tanks,Vehicles,,1"
    );
    expect(r.valid).toEqual([
      { line: 2, classNumber: "101", levelName: "Novice", name: "Tanks", group: "Vehicles", presentationOrder: 3, outOfCompetition: false }
    ]);
    expect(r.errors.map((e) => e.line)).toEqual([3, 4, 5, 6]);
  });
});
