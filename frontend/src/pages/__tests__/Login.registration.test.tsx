import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
const registrationMock = vi.fn();
const setSessionMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("../../lib/api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    code?: string;
    constructor(status: number, message: string, code?: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
  errorCode: (e: any) => e?.code,
  api: (...a: unknown[]) => (a[0] === "/public/registration" ? registrationMock(...a) : apiMock(...a))
}));
vi.mock("../../lib/auth", () => ({
  setSession: (...a: unknown[]) => setSessionMock(...a),
  generateCodeVerifier: () => "verifier",
  createCodeChallenge: async () => "challenge"
}));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

import Login from "../Login";
import { ApiError } from "../../lib/api";

function renderLogin() {
  renderWithProviders(<MemoryRouter><Login language="en" /></MemoryRouter>);
}

describe("Login: registration settings", () => {
  beforeEach(() => {
    apiMock.mockReset();
    registrationMock.mockReset().mockResolvedValue({ status: "open", defaultPage: "login" });
    setSessionMock.mockReset();
    navigateMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("opens the Sign in tab by default", async () => {
    renderLogin();
    await waitFor(() => expect(registrationMock).toHaveBeenCalledWith("/public/registration"));
    expect(screen.getByRole("tab", { name: "Sign in" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens the Sign up tab first when the default page is register", async () => {
    registrationMock.mockResolvedValue({ status: "open", defaultPage: "register" });
    renderLogin();
    expect(await screen.findByRole("tab", { name: "Sign up" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it("shows the closed message instead of the sign-up form, and sign in still works", async () => {
    registrationMock.mockResolvedValue({ status: "closed", defaultPage: "register" });
    apiMock.mockResolvedValueOnce({ accessToken: "a", refreshToken: "r", expiresIn: 60 });
    const user = userEvent.setup();
    renderLogin();

    expect(await screen.findByText("Registrations are closed")).toBeInTheDocument();
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Sign in" }));
    await user.type(screen.getByLabelText(/email/i), "a@b.it");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/"));
    expect(apiMock).toHaveBeenCalledWith("/auth/login", expect.objectContaining({ method: "POST" }));
  });

  it("maps REGISTRATION_CLOSED from the server to the same message", async () => {
    registrationMock.mockResolvedValue({ status: "open", defaultPage: "register" });
    apiMock.mockRejectedValueOnce(new ApiError(403, "REGISTRATION_CLOSED", "REGISTRATION_CLOSED"));
    const user = userEvent.setup();
    renderLogin();

    await user.type(await screen.findByLabelText(/^email/i), "new@b.it");
    await user.type(screen.getByLabelText(/^password/i), "secret123");
    await user.type(screen.getByLabelText(/confirm password/i), "secret123");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(await screen.findByLabelText(/first name/i), "Anna");
    await user.type(screen.getByLabelText(/last name/i), "Verdi");
    await user.type(screen.getByLabelText(/phone/i), "3331234567");
    await user.type(screen.getByLabelText(/^city/i), "Arezzo");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("checkbox", { name: /privacy notice/i }));
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Registrations are closed")).toBeInTheDocument();
    expect(apiMock.mock.calls.map((c) => c[0])).toEqual(["/auth/register"]);
    expect(screen.queryByLabelText(/confirm password/i)).not.toBeInTheDocument();
  });
});
