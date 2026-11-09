import { describe, it, expect } from "vitest";
import { t, translations } from "../i18n";

describe("i18n translations", () => {
  const itKeys = Object.keys(translations.it).sort();
  const enKeys = Object.keys(translations.en).sort();

  it("has the same keys in IT and EN", () => {
    const missingInEn = itKeys.filter((k) => !(k in translations.en));
    const missingInIt = enKeys.filter((k) => !(k in translations.it));
    expect({ missingInEn, missingInIt }).toEqual({ missingInEn: [], missingInIt: [] });
  });

  it("has a non-empty string for every key in both languages", () => {
    const empty: string[] = [];
    for (const lang of ["it", "en"] as const) {
      for (const [k, v] of Object.entries(translations[lang])) {
        if (typeof v !== "string" || v.trim() === "") empty.push(`${lang}.${k}`);
      }
    }
    expect(empty).toEqual([]);
  });

  it("keeps the same {placeholders} in both languages", () => {
    const placeholders = (s: string) => (s.match(/\{[^}]+\}/g) ?? []).sort().join(",");
    const mismatched = itKeys.filter(
      (k) => placeholders((translations.it as any)[k]) !== placeholders((translations.en as any)[k])
    );
    expect(mismatched).toEqual([]);
  });

  it("t() returns the string for the requested language", () => {
    expect(t("it", "staffCheckinPrintButton")).toBe("Stampa badge");
    expect(t("en", "staffCheckinPrintButton")).toBe("Print badge");
  });
});
