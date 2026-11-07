import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));
vi.mock("../../lib/download", () => ({ downloadAuthenticatedFile: vi.fn() }));
vi.mock("../../lib/auth", () => ({
  getRole: () => "admin",
  roleAtLeast: () => true
}));

import Admin from "../Admin";

const paths = () => apiMock.mock.calls.map((c) => c[0] as string);
const count = (p: string) => paths().filter((x) => x === p).length;

function renderAdmin() {
  return renderWithProviders(<MemoryRouter><Admin language="en" /></MemoryRouter>);
}

describe("Admin tabs load their own data only when opened", () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/events") return [{ id: "e1", name: "MSS 2026", status: "active" }];
      if (path === "/categories") return [{ id: "c1", eventId: "e1", name: "Open", status: "open" }];
      return [];
    });
  });

  it("at page open requests only events, categories and the events tab sections", async () => {
    renderAdmin();
    await screen.findAllByRole("tab");
    await waitFor(() => expect(paths()).toContain("/admin/event-campaigns"));
    expect([...new Set(paths())].sort()).toEqual(["/admin/event-campaigns", "/categories", "/events"]);
    for (const p of ["/admin/users", "/admin/judges/assignments", "/sponsors", "/awards/mentions",
      "/admin/modification-requests", "/admin/models", "/admin/levels", "/admin/member-roles"]) {
      expect(count(p)).toBe(0);
    }
  });

  it("the judges tab fetches users and assignments on first open", async () => {
    const user = userEvent.setup();
    renderAdmin();
    const tabs = await screen.findAllByRole("tab");
    await user.click(tabs[1]);
    await waitFor(() => expect(count("/admin/judges/assignments")).toBe(1));
    expect(count("/admin/users")).toBe(1);
    expect(count("/sponsors")).toBe(0);
    expect(count("/admin/levels")).toBe(0);
  });

  it("the awards tab fetches mentions, requests and the model names once", async () => {
    const user = userEvent.setup();
    renderAdmin();
    const tabs = await screen.findAllByRole("tab");
    await user.click(tabs[2]);
    await waitFor(() => expect(count("/awards/mentions")).toBe(1));
    expect(count("/admin/modification-requests")).toBe(1);
    expect(count("/admin/models")).toBe(1);
    expect(count("/admin/users")).toBe(0);
  });

  it("the sponsors tab fetches sponsors only", async () => {
    const user = userEvent.setup();
    renderAdmin();
    const tabs = await screen.findAllByRole("tab");
    await user.click(tabs[3]);
    await waitFor(() => expect(count("/sponsors")).toBe(1));
    expect(count("/admin/judges/assignments")).toBe(0);
    expect(count("/awards/mentions")).toBe(0);
  });

  it("the catalog tab fetches levels, member roles and models", async () => {
    const user = userEvent.setup();
    renderAdmin();
    const tabs = await screen.findAllByRole("tab");
    await user.click(tabs[4]);
    await waitFor(() => expect(count("/admin/levels")).toBe(1));
    expect(count("/admin/member-roles")).toBe(1);
    expect(count("/admin/models")).toBe(1);
  });

  it("switching tabs back and forth does not refetch anything", async () => {
    const user = userEvent.setup();
    renderAdmin();
    const tabs = await screen.findAllByRole("tab");
    await user.click(tabs[1]);
    await waitFor(() => expect(count("/admin/users")).toBe(1));
    await user.click(tabs[2]);
    await waitFor(() => expect(count("/admin/models")).toBe(1));
    await user.click(tabs[4]);
    await waitFor(() => expect(count("/admin/levels")).toBe(1));
    const before = apiMock.mock.calls.length;
    for (const i of [0, 1, 2, 3, 4, 0, 1]) {
      await user.click(tabs[i]);
      expect(tabs[i]).toHaveAttribute("aria-selected", "true");
    }
    await waitFor(() => expect(count("/sponsors")).toBe(1));
    const sponsorsOnly = paths().slice(before);
    // the only new request is the first open of the sponsors tab
    expect(sponsorsOnly).toEqual(["/sponsors"]);
    expect(count("/events")).toBe(1);
    expect(count("/categories")).toBe(1);
    expect(count("/admin/models")).toBe(1);
  });

  it("keeps per-section errors: a failing section shows its alert and the others still render", async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/events") return [{ id: "e1", name: "MSS 2026", status: "active" }];
      if (path === "/categories") throw new Error("boom");
      return [];
    });
    renderAdmin();
    expect(await screen.findByText(/Categories/, { selector: ".MuiAlert-message" })).toBeInTheDocument();
    expect((await screen.findAllByText("MSS 2026")).length).toBeGreaterThan(0);
  });

  it("resolves model and user names through the id maps", async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/events") return [{ id: "e1", name: "MSS 2026", status: "active" }];
      if (path === "/awards/mentions") return [{ id: "m1", eventId: "e1", modelId: "mod-12345678", title: "Best paint" }];
      if (path === "/admin/models") return [{ id: "mod-12345678", name: "Space Marine" }];
      return [];
    });
    const user = userEvent.setup();
    renderAdmin();
    const tabs = await screen.findAllByRole("tab");
    await user.click(tabs[2]);
    expect(await screen.findByText(/Space Marine/)).toBeInTheDocument();
  });
});
