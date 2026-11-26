import { describe, it, expect } from "bun:test";
import { LoginWithPassword } from "../LoginWithPassword";
import { Email } from "../../domain/Email";
import { User } from "../../domain/User";
import { InvalidCredentialsError, describeHashFormat } from "../../domain/InvalidCredentialsError";
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
    await expect(uc.execute({ email: "ghost@example.com", password: "pw" })).rejects.toThrow();
  });

  it("throws 'Invalid credentials' when password is wrong", async () => {
    const user = makeActiveUser();
    const uc = new LoginWithPassword(stubRepo(user), stubHasher(false), stubTokens());
    await expect(uc.execute({ email: "alice@example.com", password: "bad" })).rejects.toThrow("Invalid credentials");
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

  it("disabled user gets the same error as wrong credentials", async () => {
    const disabled = new User("uid-2", Email.create("bob@example.com"), "user", "hashed-pw", false);
    const uc = new LoginWithPassword(stubRepo(disabled), stubHasher(true), stubTokens());
    await expect(uc.execute({ email: "bob@example.com", password: "pw" })).rejects.toThrow(new Error("Invalid credentials"));
  });

  describe("failure reasons (server-side log only)", () => {
    async function reasonOf(promise: Promise<unknown>) {
      try { await promise; } catch (e) { return e as InvalidCredentialsError; }
      throw new Error("expected a rejection");
    }

    it("unknown email -> user_not_found, generic message", async () => {
      const uc = new LoginWithPassword(stubRepo(null), stubHasher(true), stubTokens());
      const err = await reasonOf(uc.execute({ email: "ghost@example.com", password: "pw" }));
      expect(err).toBeInstanceOf(InvalidCredentialsError);
      expect(err.reason).toBe("user_not_found");
      expect(err.message).toBe("Invalid credentials");
    });

    it("wrong password -> wrong_password with the stored hash FORMAT, never the hash", async () => {
      const user = new User("uid-3", Email.create("carol@example.com"), "user", "$argon2id$v=19$m=65536,t=2,p=1$abc$def", true);
      const uc = new LoginWithPassword(stubRepo(user), stubHasher(false), stubTokens());
      const err = await reasonOf(uc.execute({ email: "carol@example.com", password: "pw" }));
      expect(err.reason).toBe("wrong_password");
      expect(err.detail).toEqual({ hashFormat: "argon2id", hashLength: user.passwordHash.length });
      expect(JSON.stringify(err.detail)).not.toContain("abc$def");
    });

    it("a corrupted hash is reported as unrecognized, an empty one as empty", async () => {
      expect(describeHashFormat("argon2idv19m65536")).toEqual({ hashFormat: "unrecognized", hashLength: 17 });
      expect(describeHashFormat("")).toEqual({ hashFormat: "empty" });
      expect(describeHashFormat(null)).toEqual({ hashFormat: "empty" });
    });

    it("correct password on a disabled account -> account_disabled", async () => {
      const disabled = new User("uid-4", Email.create("dave@example.com"), "user", "hashed-pw", false);
      const uc = new LoginWithPassword(stubRepo(disabled), stubHasher(true), stubTokens());
      const err = await reasonOf(uc.execute({ email: "dave@example.com", password: "pw" }));
      expect(err.reason).toBe("account_disabled");
    });
  });
});
