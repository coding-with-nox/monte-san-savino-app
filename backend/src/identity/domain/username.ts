export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
const USERNAME_RE = new RegExp(`^[a-zA-Z0-9._-]{${USERNAME_MIN_LENGTH},${USERNAME_MAX_LENGTH}}$`);

export type UsernameResult = { ok: true; value: string | null } | { ok: false; error: string };

/**
 * Optional username. null/undefined/blank => null (no username).
 * Otherwise 3-30 characters from [a-zA-Z0-9._-]; '@' is refused because it marks an email in the login field.
 */
export function normalizeUsername(input: unknown): UsernameResult {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== "string") return { ok: false, error: "username must be a string" };
  const raw = input.trim();
  if (!raw) return { ok: true, value: null };
  if (raw.includes("@")) return { ok: false, error: "username cannot contain '@'" };
  if (!USERNAME_RE.test(raw)) {
    return { ok: false, error: `username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters: letters, digits, '.', '_' or '-'` };
  }
  return { ok: true, value: raw };
}

/** The login field holds an email when it contains '@'; otherwise it is a username (case-insensitive). */
export function isUsernameIdentifier(identifier: string): boolean {
  return !identifier.includes("@");
}

/** Thrown by registration / profile updates when another account already holds the username (case-insensitive). */
export class UsernameTakenError extends Error {
  constructor() {
    super("Username already taken");
    this.name = "UsernameTakenError";
  }
}
