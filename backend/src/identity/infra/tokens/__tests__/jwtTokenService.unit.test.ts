import { describe, it, expect } from "bun:test";
import { SignJWT } from "jose";
import { JwtTokenService } from "../jwtTokenService";

const p = { sub: "u1", email: "a@b.it", role: "admin", tenantId: "t1" };

describe("JwtTokenService", () => {
  const svc = new JwtTokenService();
  it("signs access tokens with tokenType=access and claims", async () => {
    const { token, expiresIn } = await svc.signAccess(p);
    const v = await svc.verify(token);
    expect(v.tokenType).toBe("access");
    expect(v.sub).toBe("u1");
    expect(v.role).toBe("admin");
    expect(expiresIn).toBeGreaterThan(0);
  });
  it("signs refresh tokens with longer ttl", async () => {
    const a = await svc.signAccess(p);
    const r = await svc.signRefresh(p);
    expect((await svc.verify(r.token)).tokenType).toBe("refresh");
    expect(r.expiresIn).toBeGreaterThan(a.expiresIn);
  });
  it("rejects garbage, tampered and expired tokens", async () => {
    await expect(svc.verify("garbage")).rejects.toThrow();
    const { token } = await svc.signAccess(p);
    await expect(svc.verify(token.slice(0, -2) + "xx")).rejects.toThrow();
    const expired = await new SignJWT({ ...p }).setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret-change-me"));
    await expect(svc.verify(expired)).rejects.toThrow();
  });
  it("rejects tokens signed with another secret", async () => {
    const bad = await new SignJWT({ ...p }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h")
      .sign(new TextEncoder().encode("other-secret"));
    await expect(svc.verify(bad)).rejects.toThrow();
  });
});
