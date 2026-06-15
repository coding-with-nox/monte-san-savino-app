import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ThemeProvider } from "@mui/material";
import { render } from "@testing-library/react";
import { buildTheme } from "../../lib/theme";
import Profile from "../Profile";

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

// Mock auth helpers
vi.mock("../../lib/auth", () => ({
  getToken: vi.fn(() => null),
  getRefreshToken: vi.fn(() => null),
  getTokenExpiresAt: vi.fn(() => null),
  setSession: vi.fn(),
  clearToken: vi.fn(),
}));

const mockProfile = {
  email: "mario@example.com",
  role: "user",
  firstName: "Mario",
  lastName: "Rossi",
  phone: null,
  city: "Florence",
  emergencyContact: null,
  emergencyContactName: null,
};

const theme = buildTheme("dark", "violet");

function renderProfile() {
  return render(
    <ThemeProvider theme={theme}>
      <Profile language="en" />
    </ThemeProvider>
  );
}

describe("Profile smoke tests", () => {
  afterEach(() => { vi.clearAllMocks(); });

  it("renders without crashing and shows page heading", async () => {
    const { api } = await import("../../lib/api");
    (api as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockProfile);

    renderProfile();
    await waitFor(() => {
      expect(screen.getByText("Profile")).toBeInTheDocument();
    });
  });

  it("renders the user first name after data loads", async () => {
    const { api } = await import("../../lib/api");
    (api as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockProfile);

    renderProfile();
    await waitFor(() => {
      expect(screen.getByText("Mario")).toBeInTheDocument();
    });
  });

  it("renders the user last name after data loads", async () => {
    const { api } = await import("../../lib/api");
    (api as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockProfile);

    renderProfile();
    await waitFor(() => {
      expect(screen.getByText("Rossi")).toBeInTheDocument();
    });
  });

  it("renders the user email after data loads", async () => {
    const { api } = await import("../../lib/api");
    (api as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockProfile);

    renderProfile();
    await waitFor(() => {
      expect(screen.getByText("mario@example.com")).toBeInTheDocument();
    });
  });
});
