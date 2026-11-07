import React from "react";
import { act, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "../test/renderWithProviders";

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return { ...actual, api: vi.fn(async () => ({})) };
});
vi.mock("../pages/Login", () => ({ default: () => <div>LOGIN PAGE</div> }));
vi.mock("../pages/Models", () => ({ default: () => <div>MODELS PAGE</div> }));

import App from "../App";
import { AUTH_LOGOUT_EVENT, AuthLogoutDetail, signalLogout } from "../lib/api";
import { setSession } from "../lib/auth";

function jwt(payload: object) {
  return `h.${btoa(JSON.stringify(payload))}.s`;
}

describe("App session handling", () => {
  beforeEach(() => {
    localStorage.clear();
    setSession(jwt({ role: "user", email: "a@b.it" }), "refresh", 3600);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lazy-loads a page behind the skeleton fallback", async () => {
    renderWithProviders(<MemoryRouter initialEntries={["/models"]}><App /></MemoryRouter>);
    expect(await screen.findByText("MODELS PAGE")).toBeInTheDocument();
  });

  it("auth:logout clears the session and navigates to /login without a hard redirect", async () => {
    const hrefSet = vi.fn();
    vi.stubGlobal("location", { ...window.location, set href(v: string) { hrefSet(v); } });
    renderWithProviders(<MemoryRouter initialEntries={["/models"]}><App /></MemoryRouter>);
    expect(await screen.findByText("MODELS PAGE")).toBeInTheDocument();

    let detail: AuthLogoutDetail | undefined;
    await act(async () => {
      const event = new CustomEvent<AuthLogoutDetail>(AUTH_LOGOUT_EVENT, { detail: { handled: false } });
      window.dispatchEvent(event);
      detail = event.detail;
    });

    expect(detail?.handled).toBe(true);
    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
    expect(localStorage.getItem("token")).toBeNull();
    expect(hrefSet).not.toHaveBeenCalled();
  });

  it("signalLogout (as called by api.ts) is handled by the mounted App", async () => {
    const hrefSet = vi.fn();
    vi.stubGlobal("location", { ...window.location, set href(v: string) { hrefSet(v); } });
    renderWithProviders(<MemoryRouter initialEntries={["/models"]}><App /></MemoryRouter>);
    await screen.findByText("MODELS PAGE");
    await act(async () => { signalLogout(); });
    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
    expect(hrefSet).not.toHaveBeenCalled();
  });
});
