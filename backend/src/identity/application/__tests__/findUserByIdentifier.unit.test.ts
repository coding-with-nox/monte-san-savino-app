import { describe, it, expect } from "bun:test";
import { findUserByIdentifier } from "../findUserByIdentifier";
import { Email } from "../../domain/Email";
import { User } from "../../domain/User";
import type { UserRepository } from "../ports/UserRepository";

const user = new User("uid-1", Email.create("mario@example.com"), "user", "hash", true, null, "mario.rossi");

function repo(): UserRepository & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    findByEmail: async (email) => { calls.push(`email:${email.value}`); return email.value === user.email.value ? user : null; },
    findByUsername: async (name) => { calls.push(`username:${name}`); return name.toLowerCase() === "mario.rossi" ? user : null; },
    findById: async () => null,
    save: async () => {},
  };
}

describe("findUserByIdentifier", () => {
  it("looks up an identifier with '@' as an email", async () => {
    const r = repo();
    expect((await findUserByIdentifier(r, "Mario@Example.com"))?.id).toBe("uid-1");
    expect(r.calls).toEqual(["email:mario@example.com"]);
  });
  it("looks up an identifier without '@' as a username, trimmed", async () => {
    const r = repo();
    expect((await findUserByIdentifier(r, "  MARIO.rossi "))?.id).toBe("uid-1");
    expect(r.calls).toEqual(["username:MARIO.rossi"]);
  });
  it("still refuses a malformed email", async () => {
    await expect(findUserByIdentifier(repo(), "bad@")).rejects.toThrow("Invalid email");
  });
});
