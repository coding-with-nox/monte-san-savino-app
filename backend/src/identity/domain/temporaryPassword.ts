import crypto from "node:crypto";

// No ambiguous characters (0/O, 1/l/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generateTemporaryPassword(length = 16): string {
  const len = Math.max(16, length);
  let out = "";
  while (out.length < len) {
    const byte = crypto.randomBytes(1)[0]!;
    // rejection sampling to avoid modulo bias
    if (byte >= 256 - (256 % ALPHABET.length)) continue;
    out += ALPHABET[byte % ALPHABET.length];
  }
  return out;
}

export const TEMP_PASSWORD_ALPHABET = ALPHABET;
