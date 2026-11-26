import { describe, it, expect } from "bun:test";
import { DEFAULT_ROLE_PERMISSIONS, parseRolePermissions, PERMISSIONS } from "../permissions";
import { ROLES } from "../Role";

describe("rolePermissions", () => {
  it("enables enrollOnBehalf for manager and admin only by default", () => {
    expect(ROLES.filter((r) => DEFAULT_ROLE_PERMISSIONS[r].includes("enrollOnBehalf"))).toEqual(["manager", "admin"]);
  });

  it("uses the defaults for missing or malformed settings", () => {
    for (const v of [undefined, null, "", "not json", "3", "null"]) expect(parseRolePermissions(v)).toEqual(DEFAULT_ROLE_PERMISSIONS);
  });

  it("overrides only the configured roles", () => {
    const out = parseRolePermissions(JSON.stringify({ staff: ["enrollOnBehalf"], manager: [] }));
    expect(out.staff).toEqual(["enrollOnBehalf"]);
    expect(out.manager).toEqual([]);
    expect(out.user).toEqual([]);
  });

  it("ignores unknown roles and keys and non-array values", () => {
    const out = parseRolePermissions(JSON.stringify({ ghost: ["enrollOnBehalf"], staff: ["nope"], manager: "x" }));
    expect(Object.keys(out)).toEqual([...ROLES]);
    expect(out.staff).toEqual([]);
    expect(out.manager).toEqual(DEFAULT_ROLE_PERMISSIONS.manager);
  });

  it("never disables a permission for admin", () => {
    expect(parseRolePermissions(JSON.stringify({ admin: [] })).admin).toEqual([...PERMISSIONS]);
  });
});
