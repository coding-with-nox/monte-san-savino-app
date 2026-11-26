import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
const setSessionMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("../../lib/api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  api: (...a: unknown[]) => apiMock(...a)
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

async function fillAndSubmit(email = "a@b.it", password = "secret123") {
  const user = userEvent.setup();
  renderWithProviders(<MemoryRouter><Login language="en" /></MemoryRouter>);
  await user.type(screen.getByLabelText(/email/i), email);
  await user.type(screen.getByLabelText(/password/i), password);
  return user;
}

describe("Login flow", () => {
  beforeEach(() => {
    apiMock.mockReset();
    setSessionMock.mockReset();
    navigateMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("stores the session and navigates home on successful login", async () => {
    apiMock.mockResolvedValueOnce({ accessToken: "a", refreshToken: "r", expiresIn: 3600 });
    const user = await fillAndSubmit();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/"));
    expect(setSessionMock).toHaveBeenCalledWith("a", "r", 3600);
    expect(apiMock).toHaveBeenCalledWith("/auth/login", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(apiMock.mock.calls[0][1].body)).toEqual({ email: "a@b.it", password: "secret123" });
  });

  it("accepts snake_case expires_in", async () => {
    apiMock.mockResolvedValueOnce({ accessToken: "a", refreshToken: "r", expires_in: 99 });
    const user = await fillAndSubmit();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(setSessionMock).toHaveBeenCalledWith("a", "r", 99));
  });

  it("falls back to the PKCE flow when /auth/login is 404", async () => {
    apiMock
      .mockRejectedValueOnce(new ApiError(404, "nf"))
      .mockResolvedValueOnce({ code: "c1" })
      .mockResolvedValueOnce({ accessToken: "a2", refreshToken: "r2", expiresIn: 10 });
    const user = await fillAndSubmit();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/"));
    expect(apiMock.mock.calls.map((c) => c[0])).toEqual(["/auth/login", "/auth/authorize", "/auth/token"]);
    expect(JSON.parse(apiMock.mock.calls[1][1].body)).toMatchObject({ code_challenge: "challenge", code_challenge_method: "S256" });
    expect(JSON.parse(apiMock.mock.calls[2][1].body)).toEqual({ code: "c1", code_verifier: "verifier" });
    expect(setSessionMock).toHaveBeenCalledWith("a2", "r2", 10);
  });

  it("does not fall back on other errors and shows the message", async () => {
    apiMock.mockRejectedValueOnce(new ApiError(401, "Wrong password"));
    const user = await fillAndSubmit();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Wrong password")).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("validates the email format before calling the API", async () => {
    const user = await fillAndSubmit("not-an-email");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Invalid email format")).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });
});

describe("Signup flow", () => {
  beforeEach(() => {
    apiMock.mockReset();
    setSessionMock.mockReset();
    navigateMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  async function openSignup() {
    const user = userEvent.setup();
    renderWithProviders(<MemoryRouter><Login language="en" /></MemoryRouter>);
    await user.click(screen.getByRole("tab", { name: "Sign up" }));
    return user;
  }

  async function completeSteps(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/^email/i), "new@b.it");
    await user.type(screen.getByLabelText(/^password/i), "secret123");
    await user.type(screen.getByLabelText(/confirm password/i), "secret123");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(await screen.findByLabelText(/first name/i), "Anna");
    await user.type(screen.getByLabelText(/last name/i), "Verdi");
    await user.type(screen.getByLabelText(/phone/i), "3331234567");
    await user.type(screen.getByLabelText(/^city/i), "Arezzo");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("checkbox", { name: /privacy notice/i }));
  }

  it("switches between the Sign in and Sign up tabs", async () => {
    await openSignup();
    expect(screen.getByRole("tab", { name: "Sign up" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it("blocks the first step on invalid email, short password and mismatch", async () => {
    const user = await openSignup();
    await user.type(screen.getByLabelText(/^email/i), "bad");
    await user.type(screen.getByLabelText(/^password/i), "short");
    await user.type(screen.getByLabelText(/confirm password/i), "other");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Invalid email format")).toBeInTheDocument();
    expect(screen.getByText(/at least 8 characters long/i)).toBeInTheDocument();
    expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("requires the personal details on the second step", async () => {
    const user = await openSignup();
    await user.type(screen.getByLabelText(/^email/i), "new@b.it");
    await user.type(screen.getByLabelText(/^password/i), "secret123");
    await user.type(screen.getByLabelText(/confirm password/i), "secret123");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(await screen.findByRole("button", { name: "Next" }));
    expect(screen.getAllByText("Required field.").length).toBeGreaterThanOrEqual(3);
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("requires the privacy consent", async () => {
    const user = await openSignup();
    await completeSteps(user);
    await user.click(screen.getByRole("checkbox", { name: /privacy notice/i })); // uncheck
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/must confirm/i)).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("registers, logs in, saves the personal details and goes home", async () => {
    apiMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ accessToken: "a", refreshToken: "r", expiresIn: 5 })
      .mockResolvedValueOnce({ updated: true });
    const user = await openSignup();
    await completeSteps(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/"));
    expect(apiMock.mock.calls.map((c) => c[0])).toEqual(["/auth/register", "/auth/login", "/users/profile"]);
    expect(JSON.parse(apiMock.mock.calls[0][1].body)).toEqual({ email: "new@b.it", password: "secret123", privacyAccepted: true, privacyVersion: expect.any(String) });
    expect(JSON.parse(apiMock.mock.calls[2][1].body)).toMatchObject({
      firstName: "Anna", lastName: "Verdi", city: "Arezzo", country: "IT", phone: expect.stringContaining("333")
    });
  });

  it("opens the profile when the details cannot be saved after the account is created", async () => {
    apiMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ accessToken: "a", refreshToken: "r", expiresIn: 5 })
      .mockRejectedValueOnce(new ApiError(500, "boom"));
    const user = await openSignup();
    await completeSteps(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/profile"));
  });

  it("shows the invalid-credentials error when registering with an already used email", async () => {
    // /auth/register answers 200 for an existing email, then /auth/login rejects the password
    apiMock
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new ApiError(401, "Invalid credentials"));
    const user = await openSignup();
    await completeSteps(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    expect(apiMock.mock.calls.map((c) => c[0])).toEqual(["/auth/register", "/auth/login"]);
    expect(setSessionMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
