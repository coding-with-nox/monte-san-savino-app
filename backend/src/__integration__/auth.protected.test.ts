import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { buildTestApp, postJson, getJson } from "./testApp";
import { truncateUsers } from "./testDb";

const app = buildTestApp();
const TEST_EMAIL = "protected-test@example.com";
const TEST_PASSWORD = "password123";

describe("integration GET /users/profile (protected route)", () => {
  let accessToken: string;

  beforeAll(async () => {
    await truncateUsers();
    await postJson(app, "/auth/register", { email: TEST_EMAIL, password: TEST_PASSWORD });
    const loginRes = await postJson(app, "/auth/login", { email: TEST_EMAIL, password: TEST_PASSWORD });
    const loginBody = await loginRes.json() as { accessToken: string };
    accessToken = loginBody.accessToken;
  });
  afterAll(async () => { await truncateUsers(); });

  it("returns 401 when no Authorization header is sent", async () => {
    const res = await getJson(app, "/users/profile");
    expect(res.status).toBe(401);
  });

  it("returns 401 when Authorization header contains a garbage token", async () => {
    const res = await getJson(app, "/users/profile", "garbage.token.value");
    expect(res.status).toBe(401);
  });

  it("returns 200 when a valid JWT is provided", async () => {
    const res = await getJson(app, "/users/profile", accessToken);
    expect(res.status).toBe(200);
  });
});
