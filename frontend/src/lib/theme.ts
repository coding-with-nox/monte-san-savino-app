import { createTheme, Theme } from "@mui/material";

export type ThemePreset = "violet" | "ocean" | "forest";
export type ThemeMode = "light" | "dark";

const presetPrimary: Record<ThemePreset, { light: string; dark: string }> = {
  violet: { light: "#6750a4", dark: "#d0bcff" },
  ocean:  { light: "#006d77", dark: "#83c5be" },
  forest: { light: "#2d6a4f", dark: "#95d5b2" },
};

export function buildTheme(mode: ThemeMode, preset: ThemePreset): Theme {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: mode === "light" ? presetPrimary[preset].light : presetPrimary[preset].dark,
      },
    },
    typography: {
      fontFamily: '"Roboto", "Segoe UI", system-ui, sans-serif',
    },
  });
}
