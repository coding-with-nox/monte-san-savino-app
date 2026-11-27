import { describe, it, expect } from "bun:test";
import { PRINT_MESSAGES, parsePrintLang, pt } from "../printI18n";

describe("parsePrintLang", () => {
  it("accepts it and en", () => {
    expect(parsePrintLang("it")).toBe("it");
    expect(parsePrintLang("en")).toBe("en");
  });

  it("ignores case and surrounding whitespace", () => {
    expect(parsePrintLang(" EN ")).toBe("en");
    expect(parsePrintLang("It")).toBe("it");
  });

  it("falls back to it for missing or unknown values", () => {
    for (const v of [undefined, null, "", "nl", "english", 1, ["en"], {}]) {
      expect(parsePrintLang(v)).toBe("it");
    }
  });

  it("accepts the five UI languages, case- and space-insensitive", () => {
    for (const lang of ["it", "en", "es", "fr", "de"] as const) {
      expect(parsePrintLang(` ${lang.toUpperCase()} `)).toBe(lang);
    }
  });
});

describe("print dictionary", () => {
  it("has the same keys in it and en, with non-empty values", () => {
    const itKeys = Object.keys(PRINT_MESSAGES.it).sort();
    expect(Object.keys(PRINT_MESSAGES.en).sort()).toEqual(itKeys);
    for (const lang of ["it", "en"] as const) {
      for (const value of Object.values(PRINT_MESSAGES[lang])) {
        expect(value.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("returns the text of the requested language", () => {
    expect(pt("it", "common.noData")).toBe("Nessun dato");
    expect(pt("en", "common.noData")).toBe("No data");
  });

  it("interpolates placeholders in a single pass without re-expanding values", () => {
    expect(pt("en", "pricing.freeEntry", { model: "{name}" })).toBe("Free entry - {name}");
    expect(pt("it", "pricing.coauthor", { name: "A", surname: "B", role: "R", models: "M" })).toBe("Coautore A B (R) - M");
  });
});
