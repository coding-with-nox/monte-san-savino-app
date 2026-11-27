import { describe, it, expect } from "bun:test";
import { parsePreviousResultsCsv } from "../csvImport";

const HEADER = "Email,First Name,Last Name,Level,Medal Rank,Year";

describe("parsePreviousResultsCsv", () => {
  it("parses rows with header, lower-cases emails and keeps optional fields null", () => {
    const { valid, errors } = parsePreviousResultsCsv([
      HEADER,
      "Mario@Example.com,Mario,Rossi,Standard,4,2024",
      ",Anna,Verdi,Open,2,",
    ].join("\n"));
    expect(errors).toEqual([]);
    expect(valid).toEqual([
      { line: 2, email: "mario@example.com", firstName: "Mario", lastName: "Rossi", levelName: "Standard", medalRank: 4, year: 2024 },
      { line: 3, email: null, firstName: "Anna", lastName: "Verdi", levelName: "Open", medalRank: 2, year: null },
    ]);
  });

  it("works without the header line", () => {
    const { valid } = parsePreviousResultsCsv("a@x.it,,,Standard,4,2023\n");
    expect(valid).toHaveLength(1);
    expect(valid[0].firstName).toBeNull();
  });

  it("requires an email or both first and last name", () => {
    const { valid, errors } = parsePreviousResultsCsv([HEADER, ",Mario,,Standard,4,", ",,,Standard,4,"].join("\n"));
    expect(valid).toEqual([]);
    expect(errors.map((e) => e.line)).toEqual([2, 3]);
    expect(errors[0].message).toContain("required");
  });

  it("rejects a bad email, a missing level, a bad medal rank and a bad year", () => {
    const { valid, errors } = parsePreviousResultsCsv([
      HEADER,
      "not-an-email,M,R,Standard,4,",
      "a@x.it,M,R,,4,",
      "a@x.it,M,R,Standard,11,",
      "a@x.it,M,R,Standard,x,",
      "a@x.it,M,R,Standard,4,24",
      "a@x.it,M,R,Standard,4",
    ].join("\n"));
    expect(valid).toEqual([]);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6, 7]);
    expect(errors[0].message).toContain("Email");
    expect(errors[2].message).toContain("Medal Rank");
    expect(errors[4].message).toContain("Year");
    expect(errors[5].message).toBe("Expected 6 columns");
  });

  it("medal rank 0 is valid (no medal)", () => {
    expect(parsePreviousResultsCsv("a@x.it,M,R,Standard,0,").valid[0].medalRank).toBe(0);
  });

  it("rejects formulas and HTML in cells", () => {
    const { errors } = parsePreviousResultsCsv([HEADER, "a@x.it,=HYPERLINK(),R,Standard,4,", "a@x.it,M,<b>R</b>,Standard,4,"].join("\n"));
    expect(errors.map((e) => e.line)).toEqual([2, 3]);
  });

  it("file-level errors use line 0 (oversized input)", () => {
    const big = `${HEADER}\n${"a@x.it,M,R,Standard,4,\n".repeat(2001)}`;
    const { valid, errors } = parsePreviousResultsCsv(big);
    expect(valid).toEqual([]);
    expect(errors[0].line).toBe(0);
  });
});
