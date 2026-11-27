import { describe, it, expect } from "vitest";
import { roleAtLeast, roleReaches } from "../auth";
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

describe("front desk access", () => {
  it("is for staff, manager and admin only, not for judges", () => {
    for (const r of ["staff", "manager", "admin"] as const) expect(roleReaches(r, "staff")).toBe(true);
    for (const r of ["user", "judge", "jury_president"] as const) expect(roleReaches(r, "staff")).toBe(false);
  });

  it("keeps the rank rule for the other roles", () => {
    expect(roleReaches("admin", "judge")).toBe(true);
    expect(roleReaches("staff", "judge")).toBe(false);
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
