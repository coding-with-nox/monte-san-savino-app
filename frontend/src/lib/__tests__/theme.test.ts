import { describe, it, expect } from "vitest";
import { buildTheme, DEFAULT_THEME_PRESET, THEME_PRESETS, type ThemeMode } from "../theme";

const presets = [...THEME_PRESETS];
const modes: ThemeMode[] = ["light", "dark"];

describe("buildTheme", () => {
  for (const preset of presets) {
    for (const mode of modes) {
      it(`builds ${preset}/${mode} with the requested mode and custom surface tokens`, () => {
        const theme = buildTheme(mode, preset);
        expect(theme.palette.mode).toBe(mode);
        expect(theme.palette.primary.main).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(theme.palette.surfaceContainer).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(theme.palette.surfaceVariant).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(theme.palette.background.default).toMatch(/^#/);
      });
    }
  }

  it("uses different primary colors for light and dark of the same preset", () => {
    expect(buildTheme("light", "mss").palette.primary.main).not.toBe(buildTheme("dark", "mss").palette.primary.main);
  });

  it("uses different primaries across presets", () => {
    const set = new Set(presets.map((p) => buildTheme("dark", p).palette.primary.main));
    expect(set.size).toBe(presets.length);
  });

  describe("default preset (montesansavinoshow.com palette)", () => {
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    // MUI contrastText is "#fff" or "rgba(0, 0, 0, 0.87)" (approximated as #212121)
    const full = (color: string) => (color === "#fff" ? "#ffffff" : color.startsWith("rgba") ? "#212121" : color);

    it("is savino with the site red as light primary", () => {
      expect(DEFAULT_THEME_PRESET).toBe("savino");
      expect(buildTheme("light", DEFAULT_THEME_PRESET).palette.primary.main).toBe("#A1403F");
    });

    for (const mode of modes) {
      it(`meets WCAG AA (4.5:1) for text in ${mode} mode`, () => {
        const { palette } = buildTheme(mode, DEFAULT_THEME_PRESET);
        const surfaces = [palette.background.default, palette.background.paper, palette.surfaceContainer, palette.surfaceVariant];
        for (const surface of surfaces) {
          for (const color of [palette.text.primary, palette.text.secondary, palette.primary.main]) {
            expect(ratio(color, surface)).toBeGreaterThanOrEqual(4.5);
          }
        }
        for (const c of [palette.primary, palette.secondary]) {
          expect(ratio(full(c.contrastText), c.main)).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  });
});
