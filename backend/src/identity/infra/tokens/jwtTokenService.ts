import { SignJWT, jwtVerify } from "jose";
function secret() { return new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret-change-me"); }
export class JwtTokenService {
  async sign(payload: { sub: string; email: string; role: string; tenantId?: string }) {
    return await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(process.env.JWT_EXPIRES ?? "8h").sign(secret());
  }
  async verify(token: string) { const { payload } = await jwtVerify(token, secret()); return payload; }
}
