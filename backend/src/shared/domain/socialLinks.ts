export const SOCIAL_MAX_LENGTH = 200;

export type SocialField = "instagram" | "facebook" | "website" | "patreon" | "pinterest" | "tiktok";

export const SOCIAL_FIELDS = ["instagram", "facebook", "website", "patreon", "pinterest", "tiktok"] as const;

export type SocialNormalizeResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

const HANDLE_RE = /^[A-Za-z0-9._]{1,50}$/;
const HAS_SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const BARE_DOMAIN_RE = /^(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?:[/?#].*)?$/;

function normalizeUrl(raw: string): string | null {
  let candidate = raw;
  if (!HAS_SCHEME_RE.test(candidate)) {
    if (!BARE_DOMAIN_RE.test(candidate)) return null;
    candidate = `https://${candidate}`;
  }
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname || url.username || url.password) return null;
  const out = url.toString();
  return out.length <= SOCIAL_MAX_LENGTH ? out : null;
}

/**
 * Normalizza un campo social.
 * - null/undefined/stringa vuota => null (campo svuotato)
 * - instagram/facebook/patreon/pinterest/tiktok: handle (con o senza "@", salvato SENZA "@") oppure URL http/https
 * - website: URL http/https (un dominio nudo diventa https://dominio)
 * - qualunque altro schema (javascript:, data:, ...) e' rifiutato
 */
export function normalizeSocialValue(field: SocialField, input: unknown): SocialNormalizeResult {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== "string") return { ok: false, error: `${field} must be a string` };
  const raw = input.trim();
  if (!raw) return { ok: true, value: null };
  if (raw.length > SOCIAL_MAX_LENGTH) return { ok: false, error: `${field} too long (max ${SOCIAL_MAX_LENGTH})` };
  if (/[\u0000-\u001f\u007f\s]/.test(raw)) return { ok: false, error: `${field} contains invalid characters` };

  if (field !== "website") {
    const handle = raw.replace(/^@/, "");
    if (HANDLE_RE.test(handle)) return { ok: true, value: handle };
  }
  const url = normalizeUrl(raw);
  if (!url) {
    return { ok: false, error: field === "website" ? "website must be a valid http/https URL" : `${field} must be a handle or a valid http/https URL` };
  }
  return { ok: true, value: url };
}

/** Normalizza i social presenti nel body (solo chiavi definite). */
export function normalizeSocialPatch(body: Partial<Record<SocialField, unknown>>):
  | { ok: true; patch: Partial<Record<SocialField, string | null>> }
  | { ok: false; error: string } {
  const patch: Partial<Record<SocialField, string | null>> = {};
  for (const field of SOCIAL_FIELDS) {
    if (body[field] === undefined) continue;
    const res = normalizeSocialValue(field, body[field]);
    if (!res.ok) return res;
    patch[field] = res.value;
  }
  return { ok: true, patch };
}
