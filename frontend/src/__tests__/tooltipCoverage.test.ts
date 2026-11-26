import { describe, it, expect } from "vitest";
import { translations } from "../lib/i18n";

// Lint-like rule: every action must go through components/ActionButton, which requires a tooltip.
const sources = import.meta.glob(["../**/*.tsx", "!../**/__tests__/**", "!../test/**"], {
  query: "?raw",
  import: "default",
  eager: true
}) as Record<string, string>;

const WRAPPER = "../components/ActionButton.tsx";
const RAW_BUTTON = /<(Button|IconButton|Fab|ToggleButton|LoadingButton|MenuItem(?=[^>]*\sonClick=))[\s/>]/g;
const WRAPPED = /<(ActionButton|TipIconButton|TipMenuItem)(?=\s)/g;

/** Attributes of the JSX element starting at `from` (braces are balanced, so `=>` does not end it). */
function openingTag(source: string, from: number) {
  let depth = 0;
  for (let i = from; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") depth--;
    else if (source[i] === ">" && depth === 0) return source.slice(from, i);
  }
  return source.slice(from);
}

describe("tooltip coverage", () => {
  it("scans the application sources", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(40);
  });

  it("has no button outside the tooltip wrappers", () => {
    const offenders = Object.entries(sources)
      .filter(([file]) => !file.endsWith("ActionButton.tsx"))
      .flatMap(([file, source]) => [...source.matchAll(RAW_BUTTON)].map((m) => `${file}: <${m[1]}>`));
    expect(Object.keys(sources).some((f) => f.endsWith("ActionButton.tsx")), WRAPPER).toBe(true);
    expect(offenders).toEqual([]);
  });

  it("gives every wrapped button a tooltip", () => {
    let total = 0;
    const missing: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      if (file.endsWith("ActionButton.tsx")) continue;
      for (const m of source.matchAll(WRAPPED)) {
        total++;
        const tag = openingTag(source, m.index!);
        if (!/\stip=/.test(tag)) missing.push(`${file}: ${tag.slice(0, 80)}`);
      }
    }
    expect(missing).toEqual([]);
    expect(total).toBeGreaterThan(90);
  });

  it("does not use a tooltip that merely repeats a button label", () => {
    for (const lang of ["it", "en"] as const) {
      const entries = Object.entries(translations[lang]) as [string, string][];
      const normalise = (s: string) => s.toLowerCase().replace(/[.\s]+$/, "");
      const labels = new Set(entries.filter(([k]) => !k.startsWith("tip") && !k.startsWith("tour")).map(([, v]) => normalise(v)));
      const repeated = entries.filter(([k, v]) => /^tip[A-Z]/.test(k) && labels.has(normalise(v)));
      expect(repeated).toEqual([]);
    }
  });
});
