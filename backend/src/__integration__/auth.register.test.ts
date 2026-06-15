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

  it("returns 400 when email is already registered", async () => {
    await postJson(app, "/auth/register", {
      email: "duplicate@example.com",
      password: "password123",
    });
    const res = await postJson(app, "/auth/register", {
      email: "duplicate@example.com",
      password: "password456",
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("already");
  });
});
