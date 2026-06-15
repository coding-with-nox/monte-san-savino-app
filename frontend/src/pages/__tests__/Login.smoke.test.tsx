import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material";
import { render } from "@testing-library/react";
import { buildTheme } from "../../lib/theme";
import Login from "../Login";

// Mock the api module to avoid real fetch calls and localStorage dependency
vi.mock("../../lib/api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
  api: vi.fn(),
}));

// Mock auth helpers used by api
vi.mock("../../lib/auth", () => ({
  getToken: vi.fn(() => null),
  getRefreshToken: vi.fn(() => null),
  getTokenExpiresAt: vi.fn(() => null),
  setSession: vi.fn(),
  clearToken: vi.fn(),
  generateCodeVerifier: vi.fn(() => "verifier"),
  createCodeChallenge: vi.fn(async () => "challenge"),
}));

const theme = buildTheme("dark", "violet");

function renderLogin() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <Login language="en" />
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe("Login smoke tests", () => {
  afterEach(() => { vi.clearAllMocks(); });

  it("renders email input", () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("renders password input", () => {
    renderLogin();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders login submit button", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: /login/i })).toBeInTheDocument();
  });

  it("shows error toast when API throws an error", async () => {
    const { api } = await import("../../lib/api");
    const { ApiError } = await import("../../lib/api");
    (api as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new ApiError(422, "Invalid credentials")
    );

    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText(/email/i), "bad@example.com");
    await user.type(screen.getByLabelText(/password/i), "wrongpass");
    await user.click(screen.getByRole("button", { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });
});
