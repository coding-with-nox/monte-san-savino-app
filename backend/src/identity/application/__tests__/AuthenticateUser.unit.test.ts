import { describe, it, expect } from "bun:test";
import { AuthenticateUser } from "../AuthenticateUser";
import { Email } from "../../domain/Email";
import { User } from "../../domain/User";
import type { UserRepository } from "../ports/UserRepository";
import type { PasswordHasher } from "../ports/PasswordHasher";

function makeActiveUser(): User {
  return new User("uid-1", Email.create("alice@example.com"), "user", "hashed-pw", true);
}

function makeDisabledUser(): User {
  return new User("uid-2", Email.create("bob@example.com"), "user", "hashed-pw", false);
}

function stubRepo(user: User | null): UserRepository {
  return {
    findByEmail: async () => user,
    findById: async () => null,
    save: async () => {},
  };
}

function stubHasher(result: boolean): PasswordHasher {
  return {
    hash: async (plain) => plain,
    verify: async () => result,
  };
}

describe("AuthenticateUser.unit", () => {
  it("returns the user when credentials are correct", async () => {
    const user = makeActiveUser();
    const uc = new AuthenticateUser(stubRepo(user), stubHasher(true));
    const result = await uc.execute({ email: "alice@example.com", password: "correct" });
    expect(result).toBe(user);
  });

  it("throws 'Invalid credentials' when user is not found", async () => {
    const uc = new AuthenticateUser(stubRepo(null), stubHasher(true));
    expect(uc.execute({ email: "nobody@example.com", password: "pw" })).rejects.toThrow("Invalid credentials");
  });

  it("throws when user is disabled (canLogin returns false)", async () => {
    const user = makeDisabledUser();
    const uc = new AuthenticateUser(stubRepo(user), stubHasher(true));
    expect(uc.execute({ email: "bob@example.com", password: "pw" })).rejects.toThrow();
  });

  it("throws 'Invalid credentials' when password is wrong", async () => {
    const user = makeActiveUser();
    const uc = new AuthenticateUser(stubRepo(user), stubHasher(false));
    expect(uc.execute({ email: "alice@example.com", password: "wrong" })).rejects.toThrow("Invalid credentials");
  });
});
