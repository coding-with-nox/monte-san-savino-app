import { describe, it, expect } from "bun:test";
import { LoginWithPassword } from "../LoginWithPassword";
import { Email } from "../../domain/Email";
import { User } from "../../domain/User";
import type { UserRepository } from "../ports/UserRepository";
import type { PasswordHasher } from "../ports/PasswordHasher";
import type { TokenService } from "../ports/TokenService";

function makeActiveUser(): User {
  return new User("uid-1", Email.create("alice@example.com"), "judge", "hashed-pw", true);
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

function stubTokens(): TokenService {
  return {
    signAccess: async (payload) => ({ token: `access.${payload.sub}.${payload.role}`, expiresIn: 86400 }),
    signRefresh: async (payload) => ({ token: `refresh.${payload.sub}`, expiresIn: 2592000 }),
    verify: async () => ({}),
  };
}

describe("LoginWithPassword.unit", () => {
  it("returns accessToken, refreshToken, expiresIn and role on success", async () => {
    const user = makeActiveUser();
    const uc = new LoginWithPassword(stubRepo(user), stubHasher(true), stubTokens());
    const result = await uc.execute({ email: "alice@example.com", password: "correct" });

    expect(result.accessToken).toBe("access.uid-1.judge");
    expect(result.refreshToken).toBe("refresh.uid-1");
    expect(result.expiresIn).toBe(86400);
    expect(result.role).toBe("judge");
  });

  it("throws when user not found", async () => {
    const uc = new LoginWithPassword(stubRepo(null), stubHasher(true), stubTokens());
    expect(uc.execute({ email: "ghost@example.com", password: "pw" })).rejects.toThrow();
  });

  it("throws 'Invalid credentials' when password is wrong", async () => {
    const user = makeActiveUser();
    const uc = new LoginWithPassword(stubRepo(user), stubHasher(false), stubTokens());
    expect(uc.execute({ email: "alice@example.com", password: "bad" })).rejects.toThrow("Invalid credentials");
  });

  it("token payload contains sub, email, role", async () => {
    const user = makeActiveUser();
    const payloads: Array<{ sub: string; email: string; role: string }> = [];
    const capturingTokens: TokenService = {
      signAccess: async (p) => { payloads.push(p); return { token: "tok", expiresIn: 1 }; },
      signRefresh: async (p) => { payloads.push(p); return { token: "ref", expiresIn: 1 }; },
      verify: async () => ({}),
    };
    const uc = new LoginWithPassword(stubRepo(user), stubHasher(true), capturingTokens);
    await uc.execute({ email: "alice@example.com", password: "pw" });

    expect(payloads.length).toBe(2);
    for (const p of payloads) {
      expect(p.sub).toBe("uid-1");
      expect(p.email).toBe("alice@example.com");
      expect(p.role).toBe("judge");
    }
  });
});
