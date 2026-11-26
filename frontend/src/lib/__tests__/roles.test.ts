import { describe, it, expect } from "vitest";
import { roleAtLeast } from "../auth";
import { roleLabel } from "../roles";
import { formatCents, parseEuros } from "../pricing";

describe("jury president role", () => {
  it("sits between judge and manager", () => {
    expect(roleAtLeast("jury_president", "judge")).toBe(true);
    expect(roleAtLeast("jury_president", "manager")).toBe(false);
  });

  it("has a localized label", () => {
    expect(roleLabel("it", "jury_president")).toBe("Presidente di giuria");
    expect(roleLabel("it", "judge")).toBe("judge");
  });
});

describe("euro amounts", () => {
  it("parses euros into integer cents and rejects other text", () => {
    expect(parseEuros("15")).toBe(1500);
    expect(parseEuros(" 15,50 ")).toBe(1550);
    expect(parseEuros("-1")).toBeNull();
    expect(parseEuros("abc")).toBeNull();
  });

  it("formats cents", () => {
    expect(formatCents(4000, "en")).toBe("€40.00");
  });
});
