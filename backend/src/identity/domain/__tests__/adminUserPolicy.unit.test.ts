import { describe, it, expect } from "bun:test";
import { authorizeCreateUser, authorizeUpdateUser, authorizeResetPassword, isRole } from "../adminUserPolicy";
import { generateTemporaryPassword, TEMP_PASSWORD_ALPHABET } from "../temporaryPassword";

describe("adminUserPolicy.unit", () => {
  it("manager cannot create manager or admin, can create judge", () => {
    expect(authorizeCreateUser("manager", "manager").ok).toBe(false);
    expect(authorizeCreateUser("manager", "admin").ok).toBe(false);
    expect(authorizeCreateUser("manager", "judge").ok).toBe(true);
  });
  it("admin can create any role", () => {
    expect(authorizeCreateUser("admin", "admin").ok).toBe(true);
    expect(authorizeCreateUser("admin", "manager").ok).toBe(true);
  });
  it("manager cannot promote to manager/admin", () => {
    const r = authorizeUpdateUser({ actorId: "a", actorRole: "manager", targetId: "b", targetRole: "user", newRole: "admin" });
    expect(r.ok).toBe(false);
    expect(authorizeUpdateUser({ actorId: "a", actorRole: "manager", targetId: "b", targetRole: "user", newRole: "manager" }).ok).toBe(false);
    expect(authorizeUpdateUser({ actorId: "a", actorRole: "manager", targetId: "b", targetRole: "user", newRole: "staff" }).ok).toBe(true);
  });
  it("manager cannot touch/deactivate manager or admin", () => {
    for (const targetRole of ["manager", "admin"] as const) {
      expect(authorizeUpdateUser({ actorId: "a", actorRole: "manager", targetId: "b", targetRole, newIsActive: false }).ok).toBe(false);
      expect(authorizeResetPassword({ actorId: "a", actorRole: "manager", targetId: "b", targetRole }).ok).toBe(false);
    }
    expect(authorizeResetPassword({ actorId: "a", actorRole: "manager", targetId: "b", targetRole: "judge" }).ok).toBe(true);
  });
  it("admin can touch manager and admin", () => {
    expect(authorizeUpdateUser({ actorId: "a", actorRole: "admin", targetId: "b", targetRole: "manager", newRole: "admin" }).ok).toBe(true);
    expect(authorizeResetPassword({ actorId: "a", actorRole: "admin", targetId: "b", targetRole: "admin" }).ok).toBe(true);
  });
  it("nobody changes own role or deactivates self", () => {
    expect(authorizeUpdateUser({ actorId: "a", actorRole: "admin", targetId: "a", targetRole: "admin", newRole: "user" }).ok).toBe(false);
    expect(authorizeUpdateUser({ actorId: "a", actorRole: "admin", targetId: "a", targetRole: "admin", newIsActive: false }).ok).toBe(false);
    expect(authorizeUpdateUser({ actorId: "a", actorRole: "manager", targetId: "a", targetRole: "manager", newRole: "staff" }).ok).toBe(false);
  });
  it("isRole validates literals", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("root")).toBe(false);
  });
});

describe("temporaryPassword.unit", () => {
  it("is >=16 chars, unambiguous alphabet, random", () => {
    const a = generateTemporaryPassword();
    expect(a.length).toBeGreaterThanOrEqual(16);
    for (const c of a) expect(TEMP_PASSWORD_ALPHABET.includes(c)).toBe(true);
    expect(/[0OIl1]/.test(a)).toBe(false);
    expect(generateTemporaryPassword()).not.toBe(a);
  });
});
