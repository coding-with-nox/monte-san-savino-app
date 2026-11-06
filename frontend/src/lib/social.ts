export type SocialFields = {
  instagram?: string | null;
  facebook?: string | null;
  website?: string | null;
};

export const SOCIAL_KEYS = ["instagram", "facebook", "website"] as const;

/**
 * Returns a normalized http(s) URL or null. Values without a scheme get "https://".
 * Any other scheme (javascript:, data:, ...) is rejected.
 */
export function safeHttpUrl(value?: string | null): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) && !/^[^/]*:\d+(\/|$)/.test(raw);
  const candidate = hasScheme || raw.startsWith("//") ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate.startsWith("//") ? `https:${candidate}` : candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** True when at least one non-empty social field is not a valid http(s) address. */
export function hasInvalidSocial(p: SocialFields): boolean {
  return SOCIAL_KEYS.some((k) => {
    const v = (p[k] ?? "").trim();
    return v !== "" && safeHttpUrl(v) === null;
  });
}

/** Empty strings become null so the backend clears the field. */
export function socialPayload(p: SocialFields): Record<(typeof SOCIAL_KEYS)[number], string | null> {
  return {
    instagram: (p.instagram ?? "").trim() || null,
    facebook: (p.facebook ?? "").trim() || null,
    website: (p.website ?? "").trim() || null
  };
}
