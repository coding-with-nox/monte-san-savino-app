import crypto from "node:crypto";

export const RESET_TOKEN_BYTES = 32;
export const RESET_TOKEN_TTL_MS = 60 * 60_000;

/** Random URL-safe token (32 bytes); only its hash is ever stored. */
export function generateResetToken(): string {
  return crypto.randomBytes(RESET_TOKEN_BYTES).toString("base64url");
}

/** sha256 (hex) of the token: the value kept in password_resets.token_hash. */
export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function resetTokenExpiresAt(now: number): Date {
  return new Date(now + RESET_TOKEN_TTL_MS);
}

/** Usable only when not used yet and still before expires_at. */
export function isResetTokenUsable(row: { expiresAt: Date; usedAt: Date | null }, now: number): boolean {
  return row.usedAt === null && row.expiresAt.getTime() > now;
}
