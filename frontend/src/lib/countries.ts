import type { Language } from "./i18n";

/** ISO 3166-1 alpha-2 codes. Names are produced by Intl.DisplayNames (IT/EN), with the code as fallback. */
export const COUNTRY_CODES = [
  "AL", "AD", "AT", "BY", "BE", "BA", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IE", "IT",
  "XK", "LV", "LI", "LT", "LU", "MT", "MD", "MC", "ME", "NL", "MK", "NO", "PL", "PT", "RO", "RU", "SM", "RS", "SK", "SI",
  "ES", "SE", "CH", "UA", "GB", "VA", "US", "CA", "MX", "BR", "AR", "CL", "CO", "PE", "UY", "AU", "NZ", "JP", "CN", "KR",
  "IN", "SG", "TH", "ID", "MY", "PH", "VN", "AE", "SA", "IL", "TR", "EG", "MA", "TN", "ZA", "NG", "KE"
] as const;

export function countryName(code: string | null | undefined, language: Language): string {
  if (!code) return "";
  const upper = code.toUpperCase();
  try {
    const dn = new Intl.DisplayNames([language], { type: "region" });
    return dn.of(upper) ?? upper;
  } catch {
    return upper;
  }
}

export type CountryOption = { code: string; name: string };

/** Alphabetically sorted (per language) options; Italy first is not forced. */
export function countryOptions(language: Language): CountryOption[] {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, language) })).sort((a, b) =>
    a.name.localeCompare(b.name, language)
  );
}
