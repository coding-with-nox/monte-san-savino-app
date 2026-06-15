import { describe, it, expect } from "bun:test";
import { RegisterUser } from "../RegisterUser";
import { Email } from "../../domain/Email";
import { User } from "../../domain/User";
import type { UserRepository } from "../ports/UserRepository";
import type { PasswordHasher } from "../ports/PasswordHasher";

function stubRepo(existing: User | null): UserRepository & { saved: User[] } {
  const saved: User[] = [];
  return {
    saved,
    findByEmail: async () => existing,
    findById: async () => null,
    save: async (user) => { saved.push(user); },
  };
}

function stubHasher(): PasswordHasher {
  return {
    hash: async (plain) => `hashed:${plain}`,
    verify: async () => false,
  };
}

describe("RegisterUser.unit", () => {
  it("saves user with hashed password and returns id, email, role", async () => {
    const repo = stubRepo(null);
    const uc = new RegisterUser(repo, stubHasher());
    const result = await uc.execute({ id: "new-id", email: "new@example.com", password: "plaintext" });

    expect(result.id).toBe("new-id");
    expect(result.email).toBe("new@example.com");
    expect(result.role).toBe("user");
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].passwordHash).toBe("hashed:plaintext");
  });

  it("defaults role to 'user' when not provided", async () => {
    const repo = stubRepo(null);
    const uc = new RegisterUser(repo, stubHasher());
    const result = await uc.execute({ id: "id-2", email: "x@example.com", password: "pw" });
    expect(result.role).toBe("user");
  });

  it("uses the provided role when given", async () => {
    const repo = stubRepo(null);
    const uc = new RegisterUser(repo, stubHasher());
    const result = await uc.execute({ id: "id-3", email: "admin@example.com", password: "pw", role: "admin" });
    expect(result.role).toBe("admin");
  });

  it("throws 'Email already registered' when email is taken", async () => {
    const existing = new User("old-id", Email.create("taken@example.com"), "user", "h", true);
    const repo = stubRepo(existing);
    const uc = new RegisterUser(repo, stubHasher());
    await expect(uc.execute({ id: "new-id", email: "taken@example.com", password: "pw" })).rejects.toThrow("Email already registered");
  });

  it("does not call save when email is already registered", async () => {
    const existing = new User("old-id", Email.create("taken@example.com"), "user", "h", true);
    const repo = stubRepo(existing);
    const uc = new RegisterUser(repo, stubHasher());
    try { await uc.execute({ id: "new-id", email: "taken@example.com", password: "pw" }); } catch {}
    expect(repo.saved).toHaveLength(0);
  });
});
