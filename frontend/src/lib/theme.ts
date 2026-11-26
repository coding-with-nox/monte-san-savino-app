import { createTheme, Theme } from "@mui/material";

declare module "@mui/material/styles" {
  interface Palette {
    surfaceContainer: string;
    surfaceVariant: string;
  }
  interface PaletteOptions {
    surfaceContainer?: string;
    surfaceVariant?: string;
  }
}

export const THEME_PRESETS = ["savino", "violet", "ocean", "forest", "mss"] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];
/** Default: palette taken from montesansavinoshow.com. */
export const DEFAULT_THEME_PRESET: ThemePreset = "savino";
export function isThemePreset(value: unknown): value is ThemePreset {
  return (THEME_PRESETS as readonly unknown[]).includes(value);
}
export type ThemeMode = "light" | "dark";

const presetPrimary: Record<ThemePreset, { light: string; dark: string }> = {
  savino: { light: "#A1403F", dark: "#E8908F" },
  violet: { light: "#6750a4", dark: "#d0bcff" },
  ocean:  { light: "#006d77", dark: "#83c5be" },
  forest: { light: "#2d6a4f", dark: "#95d5b2" },
  mss:    { light: "#8B1C2B", dark: "#F4A0B0" },
};

const surfaceTokens: Record<ThemePreset, Record<ThemeMode, { default: string; paper: string; container: string; variant: string }>> = {
  savino: {
    dark:  { default: "#161922", paper: "#1E222D", container: "#252A37", variant: "#3D2A33" },
    light: { default: "#F2F2F2", paper: "#FFFFFF", container: "#FFFFFF", variant: "#F6E6E6" },
  },
  violet: {
    dark:  { default: "#141218", paper: "#1d1b20", container: "#2b2930", variant: "#4a4458" },
    light: { default: "#fef7ff", paper: "#ffffff",  container: "#f3edf7", variant: "#e8def8" },
  },
  ocean: {
    dark:  { default: "#0e1a1b", paper: "#141f20", container: "#1f2d2e", variant: "#374849" },
    light: { default: "#f2fbfc", paper: "#ffffff",  container: "#e6f4f5", variant: "#cce8ea" },
  },
  forest: {
    dark:  { default: "#101a14", paper: "#16201a", container: "#1e2d22", variant: "#2d4233" },
    light: { default: "#f2faf4", paper: "#ffffff",  container: "#e6f4ea", variant: "#c8e6ce" },
  },
  mss: {
    dark:  { default: "#1A0D0F", paper: "#22111A", container: "#2E1620", variant: "#4A2030" },
    light: { default: "#FFF5F6", paper: "#ffffff",  container: "#F9EAEC", variant: "#F0D0D5" },
  },
};

const secondaryMain: Record<ThemePreset, { light: string; dark: string }> = {
  savino: { light: "#892020", dark: "#D9B8A8" },
  violet: { light: "#625b71", dark: "#ccc2dc" },
  ocean:  { light: "#4a6267", dark: "#a0cdd2" },
  forest: { light: "#52634f", dark: "#b4ccb0" },
  mss:    { light: "#7A4520", dark: "#D4A070" },
};

/** Presets without an entry keep the MUI default text colors. */
const textTokens: Partial<Record<ThemePreset, Record<ThemeMode, { primary: string; secondary: string }>>> = {
  savino: {
    light: { primary: "#161922", secondary: "#545454" },
    dark:  { primary: "#F2F2F2", secondary: "#BBBBBB" },
  },
};

export function buildTheme(mode: ThemeMode, preset: ThemePreset): Theme {
  const s = surfaceTokens[preset][mode];
  return createTheme({
    palette: {
      mode,
      primary: {
        main: mode === "light" ? presetPrimary[preset].light : presetPrimary[preset].dark,
      },
      secondary: {
        main: mode === "light" ? secondaryMain[preset].light : secondaryMain[preset].dark,
      },
      ...(textTokens[preset] ? { text: textTokens[preset]![mode] } : {}),
      background: {
        default: s.default,
        paper: s.paper,
      },
      surfaceContainer: s.container,
      surfaceVariant: s.variant,
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: '"Roboto", "Segoe UI", system-ui, sans-serif',
      h4: {
        fontWeight: 600,
        letterSpacing: "-0.02em",
      },
      h6: {
        fontWeight: 600,
        fontSize: "1rem",
        letterSpacing: "0.01em",
      },
      caption: {
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase" as const,
        fontSize: "0.7rem",
      },
      body1: {
        fontWeight: 400,
      },
    },
    components: {
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: s.container,
            borderRadius: 20,
            border: `1px solid ${mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: "20px 24px",
            "&:last-child": { paddingBottom: "20px" },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 20,
            textTransform: "none",
            fontWeight: 600,
            paddingLeft: 20,
            paddingRight: 20,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 16 },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 8 },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 20 },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 12 },
        },
      },
    },
  });
}
