import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
const registrationMock = vi.fn();
const setSessionMock = vi.fn();
const navigateMock = vi.fn();
// Captures what the Turnstile widget receives and whether the page asks it to reset.
const turnstile = vi.hoisted(() => ({ received: [] as Array<{ siteKey: string }>, reset: vi.fn() }));

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
// The widget is the only piece that talks to Cloudflare: it reports a token straight away.
vi.mock("../../components/TurnstileWidget", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  const Widget = React.forwardRef<{ reset: () => void }, { siteKey: string; onToken: (token: string) => void }>(
    function Widget(props, ref) {
      React.useImperativeHandle(ref, () => ({ reset: () => turnstile.reset() }));
      React.useEffect(() => {
        turnstile.received.push({ siteKey: props.siteKey });
        props.onToken("tok-1");
      }, []);
      return null;
    }
  );
  return { default: Widget };
});

import Login from "../Login";
import { ApiError } from "../../lib/api";

function renderLogin() {
  return renderWithProviders(<MemoryRouter><Login language="en" /></MemoryRouter>);
}

beforeEach(() => {
  apiMock.mockReset();
  registrationMock.mockReset().mockResolvedValue({ status: "open", defaultPage: "login" });
  setSessionMock.mockReset();
  navigateMock.mockReset();
  turnstile.received.length = 0;
  turnstile.reset.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Login by username", () => {
  it("labels the sign-in field as email or username and sends the identifier as typed", async () => {
    apiMock.mockResolvedValueOnce({ accessToken: "a", refreshToken: "r", expiresIn: 60 });
    const user = userEvent.setup();
    renderLogin();

    const field = screen.getByLabelText("Email or username");
    expect(field).toBeInTheDocument();
    await user.type(field, "mario_rossi");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/"));
    expect(JSON.parse(apiMock.mock.calls[0][1].body)).toEqual({ email: "mario_rossi", password: "secret123" });
  });
});

describe("Forgot password dialog", () => {
  it("asks for the email and always confirms with the generic message", async () => {
    apiMock.mockResolvedValueOnce({ sent: true });
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/email/i), "mario@example.it");
    await user.click(within(dialog).getByRole("button", { name: "Send link" }));

    expect(await within(dialog).findByText("If the address is registered you will receive an email with the link.")).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith("/auth/forgot-password", expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(apiMock.mock.calls[0][1].body)).toEqual({ email: "mario@example.it", lang: "en" });
  });

  it("does not call the API for an invalid email", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/email/i), "not-an-email");
    await user.click(within(dialog).getByRole("button", { name: "Send link" }));

    expect(await within(dialog).findByText("Invalid email format")).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });
});

describe("Sign up with username and captcha", () => {
  async function fillSignup(user: ReturnType<typeof userEvent.setup>, username: string) {
    await user.type(await screen.findByLabelText(/^email/i), "new@b.it");
    await user.type(screen.getByLabelText(/username/i), username);
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

  it("sends the username and the Turnstile token that the widget produced", async () => {
    registrationMock.mockResolvedValue({ status: "open", defaultPage: "register", turnstileSiteKey: "site-key" });
    apiMock.mockImplementation(async (path: string) => (path === "/auth/login" ? { accessToken: "a", refreshToken: "r", expiresIn: 60 } : {}));
    const user = userEvent.setup();
    renderLogin();

    await fillSignup(user, "mario_rossi");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/"));
    expect(turnstile.received).toEqual([{ siteKey: "site-key" }]);
    const register = apiMock.mock.calls.find((c) => c[0] === "/auth/register");
    expect(JSON.parse(register![1].body)).toMatchObject({ email: "new@b.it", username: "mario_rossi", turnstileToken: "tok-1" });
  });

  it("goes back to the account step with the username error on 409 USERNAME_TAKEN", async () => {
    registrationMock.mockResolvedValue({ status: "open", defaultPage: "register" });
    apiMock.mockRejectedValueOnce(new ApiError(409, "USERNAME_TAKEN", "USERNAME_TAKEN"));
    const user = userEvent.setup();
    renderLogin();

    await fillSignup(user, "taken_name");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("This username is already taken. Please choose another one.")).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();
  });

  it("resets the widget and tells the user when the captcha is rejected", async () => {
    registrationMock.mockResolvedValue({ status: "open", defaultPage: "register", turnstileSiteKey: "site-key" });
    apiMock.mockRejectedValueOnce(new ApiError(400, "CAPTCHA_FAILED", "CAPTCHA_FAILED"));
    const user = userEvent.setup();
    renderLogin();

    await fillSignup(user, "mario_rossi");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("The security check failed. Please try again.")).toBeInTheDocument();
    expect(turnstile.reset).toHaveBeenCalledTimes(1);
  });
});
