import { SignJWT, jwtVerify } from "jose";

const DEFAULT_ACCESS_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30;

export const MIN_JWT_SECRET_LENGTH = 32;

export function requireJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const value = env.JWT_SECRET;
  if (value === undefined || value.trim() === "") {
    throw new Error("JWT_SECRET environment variable is required and must not be empty");
  }
  if (value.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long`);
  }
  return value;
}

function secret() { return new TextEncoder().encode(requireJwtSecret()); }

function secondsFromEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export class JwtTokenService {
  private readonly accessTtlSeconds = secondsFromEnv(process.env.ACCESS_TOKEN_TTL_SECONDS, DEFAULT_ACCESS_TTL_SECONDS);
  private readonly refreshTtlSeconds = secondsFromEnv(process.env.REFRESH_TOKEN_TTL_SECONDS, DEFAULT_REFRESH_TTL_SECONDS);

  async signAccess(payload: { sub: string; email: string; role: string; tenantId?: string }) {
    const token = await new SignJWT({ ...payload, tokenType: "access" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + this.accessTtlSeconds)
      .sign(secret());
    return { token, expiresIn: this.accessTtlSeconds };
  }

  async signRefresh(payload: { sub: string; email: string; role: string; tenantId?: string }) {
    const token = await new SignJWT({ ...payload, tokenType: "refresh" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + this.refreshTtlSeconds)
      .sign(secret());
    return { token, expiresIn: this.refreshTtlSeconds };
  }

  async verify(token: string) {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload;
  }
}
