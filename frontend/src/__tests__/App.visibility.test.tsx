import React from "react";
import { screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return { ...actual, api: (...a: unknown[]) => apiMock(...a) };
});
vi.mock("../pages/Dashboard", () => ({ default: () => <div>HOME PAGE</div> }));

import App from "../App";
import { setSession } from "../lib/auth";

function login(role: string) {
  setSession(`h.${btoa(JSON.stringify({ role, email: "a@b.it" }))}.s`, "refresh", 3600);
}
const render = () => renderWithProviders(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
// The test viewport has no media queries, so the desktop navigation is rendered.
const link = (name: string) => screen.queryByRole("link", { name });

describe("App navigation visibility", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("language", "en");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("shows only the sections returned by the backend and no Teams entry", async () => {
    login("jury_president");
    apiMock.mockReset().mockImplementation(async (path: string) =>
      path === "/settings/section-visibility" ? { sections: ["dashboard", "stats"] } : {});
    render();
    await screen.findByText("HOME PAGE");
    await waitFor(() => expect(link("Models")).not.toBeInTheDocument());
    expect(link("Statistics")).toBeInTheDocument();
    expect(link("Teams")).not.toBeInTheDocument();
  });

  it("falls back to role-based navigation when the endpoint fails", async () => {
    login("user");
    apiMock.mockReset().mockImplementation(async () => { throw new Error("down"); });
    render();
    await screen.findByText("HOME PAGE");
    expect(link("Models")).toBeInTheDocument();
    expect(link("Enrollments")).toBeInTheDocument();
    expect(link("Statistics")).not.toBeInTheDocument();
  });
});
