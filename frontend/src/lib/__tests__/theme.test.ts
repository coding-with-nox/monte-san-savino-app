import { describe, it, expect } from "vitest";
import { buildTheme, type ThemeMode, type ThemePreset } from "../theme";

const presets: ThemePreset[] = ["violet", "ocean", "forest", "mss"];
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
});
