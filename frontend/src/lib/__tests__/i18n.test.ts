import { describe, it, expect } from "vitest";
import { languageFromBrowser, t, translations } from "../i18n";

describe("i18n translations", () => {
  const itKeys = Object.keys(translations.it).sort();
  const enKeys = Object.keys(translations.en).sort();

  it("has the same keys in IT and EN", () => {
    const missingInEn = itKeys.filter((k) => !(k in translations.en));
    const missingInIt = enKeys.filter((k) => !(k in translations.it));
    expect({ missingInEn, missingInIt }).toEqual({ missingInEn: [], missingInIt: [] });
  });

  it("has every IT key, and nothing else, in ES, FR and DE", () => {
    for (const lang of ["es", "fr", "de"] as const) {
      expect(Object.keys(translations[lang]).sort()).toEqual(itKeys);
    }
  });

  it("has a non-empty string for every key in every language", () => {
    const empty: string[] = [];
    for (const lang of ["it", "en", "es", "fr", "de"] as const) {
      for (const [k, v] of Object.entries(translations[lang])) {
        if (typeof v !== "string" || v.trim() === "") empty.push(`${lang}.${k}`);
      }
    }
    expect(empty).toEqual([]);
  });

  it("keeps the same {placeholders} in both languages", () => {
    const placeholders = (s: string) => (s.match(/\{[^}]+\}/g) ?? []).sort().join(",");
    const mismatched = itKeys.flatMap((k) =>
      (["en", "es", "fr", "de"] as const)
        .filter((lang) => placeholders((translations.it as any)[k]) !== placeholders((translations[lang] as any)[k]))
        .map((lang) => `${lang}.${k}`)
    );
    expect(mismatched).toEqual([]);
  });

  it("t() returns the string for the requested language", () => {
    expect(t("it", "staffCheckinSearch")).toBe("Cerca");
    expect(t("en", "staffCheckinSearch")).toBe("Search");
    expect(t("de", "rankName3")).toBe("Silber");
  });

  it("picks the first-visit language from the browser, English otherwise", () => {
    expect(languageFromBrowser("it-IT")).toBe("it");
    expect(languageFromBrowser("es-ES")).toBe("es");
    expect(languageFromBrowser("fr-CA")).toBe("fr");
    expect(languageFromBrowser("de")).toBe("de");
    expect(languageFromBrowser("nl-NL")).toBe("en");
    expect(languageFromBrowser("")).toBe("en");
  });
});
