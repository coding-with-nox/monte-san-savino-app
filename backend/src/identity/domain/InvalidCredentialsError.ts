export type LoginFailureReason = "user_not_found" | "wrong_password" | "account_disabled";

/**
 * Same message and HTTP status for every failure (no account enumeration), but carries a reason
 * that is written ONLY to the server log so operators can tell the cases apart.
 */
export class InvalidCredentialsError extends Error {
  constructor(public readonly reason: LoginFailureReason, public readonly detail?: Record<string, unknown>) {
    super("Invalid credentials");
    this.name = "InvalidCredentialsError";
  }
}

/** Non-secret description of a stored hash format, for diagnosing corrupted or foreign hashes. */
export function describeHashFormat(hash: string | null | undefined) {
  if (!hash) return { hashFormat: "empty" };
  const m = hash.match(/^\$([a-z0-9]+)\$/i);
  return { hashFormat: m ? m[1] : "unrecognized", hashLength: hash.length };
}
