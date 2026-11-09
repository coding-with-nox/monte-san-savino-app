import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { buildTestApp, postJson } from "./testApp";
import { truncateUsers } from "./testDb";

const app = buildTestApp();

describe("integration POST /auth/register", () => {
  beforeAll(async () => { await truncateUsers(); });
  afterAll(async () => { await truncateUsers(); });

  it("registers a new user and returns id, email, role", async () => {
    const res = await postJson(app, "/auth/register", {
      email: "register-test@example.com",
      password: "password123",
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; email: string; role: string };
    expect(body.email).toBe("register-test@example.com");
    expect(body.role).toBe("user");
    expect(typeof body.id).toBe("string");
    expect(body.id.length).toBeGreaterThan(0);
  });

  it("returns 400 when password is shorter than 8 characters", async () => {
    const res = await postJson(app, "/auth/register", {
      email: "short-pw@example.com",
      password: "abc123",
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("8");
  });

  it("does not reveal that an email is already registered and keeps the original password", async () => {
    await postJson(app, "/auth/register", {
      email: "duplicate@example.com",
      password: "password123",
    });
    const res = await postJson(app, "/auth/register", {
      email: "duplicate@example.com",
      password: "password456",
    });
    // Same response shape as a fresh registration: no enumeration of existing accounts.
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; email: string; role: string; error?: string };
    expect(body.error).toBeUndefined();
    expect(body.email).toBe("duplicate@example.com");
    // The second registration must not change the existing account's password.
    const original = await postJson(app, "/auth/login", { email: "duplicate@example.com", password: "password123" });
    expect(original.status).toBe(200);
    const overwritten = await postJson(app, "/auth/login", { email: "duplicate@example.com", password: "password456" });
    expect(overwritten.status).toBe(401);
  });
});
