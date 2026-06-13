import React from "react";
import { render, RenderResult } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { buildTheme } from "../lib/theme";

const theme = buildTheme("dark", "violet");

export function renderWithProviders(ui: React.ReactElement): RenderResult {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}
