import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { requireRole } from "../role.middleware";
import { authMiddleware } from "../auth.middleware";
import { JwtTokenService } from "../../tokens/jwtTokenService";

const originalSecret = process.env.JWT_SECRET;
beforeAll(() => { process.env.JWT_SECRET = "test-secret"; });
afterAll(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

const svc = new JwtTokenService();
const claims = (role: string) => ({ sub: "u1", email: "a@b.it", role });
const bearer = async (role: string, kind: "access" | "refresh" = "access") =>
  ({ authorization: `Bearer ${(await (kind === "access" ? svc.signAccess(claims(role)) : svc.signRefresh(claims(role)))).token}` });

const guarded = new Elysia().use(requireRole("manager")).get("/x", () => ({ ok: true }));
const call = (app: { handle: (r: Request) => Promise<Response> }, headers: Record<string, string> = {}) =>
  app.handle(new Request("http://localhost/x", { headers }));

describe("requireRole", () => {
  it("401 without token", async () => {
    const res = await call(guarded);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthenticated" });
  });
  it("401 with invalid token or non-Bearer scheme", async () => {
    expect((await call(guarded, { authorization: "Bearer junk" })).status).toBe(401);
    expect((await call(guarded, { authorization: "Basic abc" })).status).toBe(401);
  });
  it("401 when a refresh token is used as access", async () => {
    expect((await call(guarded, await bearer("admin", "refresh"))).status).toBe(401);
  });
  it("403 when role is below minimum", async () => {
    for (const r of ["user", "staff", "judge"]) expect((await call(guarded, await bearer(r))).status).toBe(403);
  });
  it("200 when role meets or exceeds minimum", async () => {
    for (const r of ["manager", "admin"]) expect((await call(guarded, await bearer(r))).status).toBe(200);
  });
  it("403 for unknown role", async () => {
    expect((await call(guarded, await bearer("hacker"))).status).toBe(403);
  });
});

describe("authMiddleware", () => {
  it("derives user from a valid access token, null otherwise", async () => {
    const app = new Elysia().use(authMiddleware).get("/x", ({ user }) => ({ user }));
    const ok = await (await call(app, await bearer("judge"))).json() as any;
    expect(ok.user).toMatchObject({ id: "u1", email: "a@b.it", role: "judge" });
    expect(((await (await call(app)).json()) as any).user).toBeNull();
  });
});
