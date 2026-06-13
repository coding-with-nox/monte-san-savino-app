import { describe, it, expect } from "bun:test";
import { roleAtLeast } from "../Role";

describe("roleAtLeast.unit", () => {
  it("admin is at least user", () => {
    expect(roleAtLeast("admin", "user")).toBe(true);
  });

  it("user is NOT at least admin", () => {
    expect(roleAtLeast("user", "admin")).toBe(false);
  });

  it("same role satisfies itself", () => {
    expect(roleAtLeast("judge", "judge")).toBe(true);
    expect(roleAtLeast("staff", "staff")).toBe(true);
    expect(roleAtLeast("manager", "manager")).toBe(true);
  });

  it("ordering: user < staff < judge < manager < admin", () => {
    const roles = ["user", "staff", "judge", "manager", "admin"] as const;
    for (let i = 0; i < roles.length; i++) {
      for (let j = 0; j <= i; j++) {
        expect(roleAtLeast(roles[i], roles[j])).toBe(true);
      }
      for (let j = i + 1; j < roles.length; j++) {
        expect(roleAtLeast(roles[i], roles[j])).toBe(false);
      }
    }
  });
});
