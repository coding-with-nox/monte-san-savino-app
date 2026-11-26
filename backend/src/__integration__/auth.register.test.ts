import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { buildTestApp, postJson } from "./testApp";
import { getTestDb, truncateUsers } from "./testDb";
import { eq } from "drizzle-orm";
import { usersTable } from "../identity/infra/persistence/schema";

const app = buildTestApp();

describe("integration POST /auth/register", () => {
  beforeAll(async () => { await truncateUsers(); });
  afterAll(async () => { await truncateUsers(); });

  it("registers a new user and returns id, email, role", async () => {
    const res = await postJson(app, "/auth/register", {
      email: "register-test@example.com",
      password: "password123",
      privacyAccepted: true,
      privacyVersion: "2026-11-26",
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
      privacyAccepted: true,
      privacyVersion: "2026-11-26",
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("8");
  });

  it("does not reveal that an email is already registered and keeps the original password", async () => {
    await postJson(app, "/auth/register", {
      email: "duplicate@example.com",
      password: "password123",
      privacyAccepted: true,
      privacyVersion: "2026-11-26",
    });
    const res = await postJson(app, "/auth/register", {
      email: "duplicate@example.com",
      password: "password456",
      privacyAccepted: true,
      privacyVersion: "2026-11-26",
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
  it("rejects a registration without the privacy acknowledgement", async () => {
    const missing = await postJson(app, "/auth/register", { email: "noconsent@example.com", password: "password123" });
    expect(missing.status).toBeGreaterThanOrEqual(400);
    const refused = await postJson(app, "/auth/register", {
      email: "noconsent@example.com", password: "password123", privacyAccepted: false, privacyVersion: "2026-11-26"
    });
    expect(refused.status).toBe(400);
    const rows = await getTestDb().select().from(usersTable).where(eq(usersTable.email, "noconsent@example.com"));
    expect(rows).toHaveLength(0);
  });

  it("stores when and which privacy notice version was accepted", async () => {
    const res = await postJson(app, "/auth/register", {
      email: "consent@example.com", password: "password123", privacyAccepted: true, privacyVersion: "2026-11-26"
    });
    const { id } = await res.json() as { id: string };
    const [row] = await getTestDb().select().from(usersTable).where(eq(usersTable.id, id as any));
    expect(row.privacyPolicyVersion).toBe("2026-11-26");
    expect(row.privacyAcceptedAt).toBeInstanceOf(Date);
  });
});
