import { SOCIAL_FIELDS, type SocialField } from "../../shared/domain/socialLinks";

export const COUNTRY_MAX_LENGTH = 100;

export type CountryResult = { ok: true; value: string | null } | { ok: false; error: string };

/** null/undefined/vuoto => null; niente caratteri di controllo; max 100. */
export function normalizeCountry(input: unknown): CountryResult {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== "string") return { ok: false, error: "country must be a string" };
  const raw = input.trim();
  if (!raw) return { ok: true, value: null };
  if (raw.length > COUNTRY_MAX_LENGTH) return { ok: false, error: `country too long (max ${COUNTRY_MAX_LENGTH})` };
  if (/[\u0000-\u001f\u007f]/.test(raw)) return { ok: false, error: "country contains invalid characters" };
  return { ok: true, value: raw };
}

/**
 * Rimuove paese e social se publicProfile non e' true.
 * Da usare in OGNI endpoint /public/* che esponga dati utente.
 */
export function toPublicProfile<T extends Partial<Record<SocialField | "country" | "publicProfile", unknown>>>(row: T): Partial<T> {
  if (row.publicProfile !== true) {
    const out: Record<string, unknown> = { ...row };
    for (const key of [...SOCIAL_FIELDS, "country"]) delete out[key];
    delete out.publicProfile;
    return out as Partial<T>;
  }
  const { publicProfile: _p, ...rest } = row;
  return rest as Partial<T>;
}

/** Valida/normalizza i campi profilo extra (country) presenti nel body. */
export function normalizeProfilePatch(body: { country?: unknown }):
  | { ok: true; patch: { country?: string | null } }
  | { ok: false; error: string } {
  if (body.country === undefined) return { ok: true, patch: {} };
  const res = normalizeCountry(body.country);
  if (!res.ok) return res;
  return { ok: true, patch: { country: res.value } };
}
