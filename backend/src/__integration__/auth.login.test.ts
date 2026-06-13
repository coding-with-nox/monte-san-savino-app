import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { buildTestApp, postJson } from "./testApp";
import { truncateUsers } from "./testDb";

const app = buildTestApp();
const TEST_EMAIL = "login-test@example.com";
const TEST_PASSWORD = "password123";

describe("integration POST /auth/login", () => {
  beforeAll(async () => {
    await truncateUsers();
    await postJson(app, "/auth/register", { email: TEST_EMAIL, password: TEST_PASSWORD });
  });
  afterAll(async () => { await truncateUsers(); });

  it("returns accessToken, refreshToken, expiresIn and role on valid credentials", async () => {
    const res = await postJson(app, "/auth/login", { email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    const body = await res.json() as { accessToken: string; refreshToken: string; expiresIn: number; role: string };
    expect(typeof body.accessToken).toBe("string");
    expect(body.accessToken.length).toBeGreaterThan(0);
    expect(typeof body.refreshToken).toBe("string");
    expect(typeof body.expiresIn).toBe("number");
    expect(body.expiresIn).toBeGreaterThan(0);
    expect(body.role).toBe("user");
  });

  it("returns 401 on wrong password", async () => {
    const res = await postJson(app, "/auth/login", { email: TEST_EMAIL, password: "wrongpassword" });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("credentials");
  });

  it("returns 401 when user does not exist", async () => {
    const res = await postJson(app, "/auth/login", { email: "nobody@example.com", password: "somepassword" });
    expect(res.status).toBe(401);
  });
});

describe("integration POST /auth/refresh", () => {
  let refreshToken: string;

  beforeAll(async () => {
    await truncateUsers();
    await postJson(app, "/auth/register", { email: TEST_EMAIL, password: TEST_PASSWORD });
    const loginRes = await postJson(app, "/auth/login", { email: TEST_EMAIL, password: TEST_PASSWORD });
    const loginBody = await loginRes.json() as { refreshToken: string };
    refreshToken = loginBody.refreshToken;
  });
  afterAll(async () => { await truncateUsers(); });

  it("returns new accessToken and refreshToken given a valid refresh token", async () => {
    const res = await postJson(app, "/auth/refresh", { refreshToken });
    expect(res.status).toBe(200);
    const body = await res.json() as { accessToken: string; refreshToken: string; role: string };
    expect(typeof body.accessToken).toBe("string");
    expect(body.accessToken.length).toBeGreaterThan(0);
    expect(body.role).toBe("user");
  });

  it("returns 401 when refresh token is invalid", async () => {
    const res = await postJson(app, "/auth/refresh", { refreshToken: "not.a.valid.token" });
    expect(res.status).toBe(401);
  });
});
