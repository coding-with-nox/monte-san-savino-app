import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
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
vi.mock("../../lib/download", () => ({ downloadAuthenticatedFile: vi.fn() }));
vi.mock("../../components/PrintActions", () => ({ default: () => null }));

import Users from "../Users";
import { ApiError } from "../../lib/api";

const users = [
  { id: "u1", email: "mario@example.com", role: "user", isActive: true },
  { id: "u2", email: "admin@example.com", role: "admin", isActive: false }
];

function setup(list = users) {
  apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/admin/users" && !init) return list;
    if (path === "/events") return [{ id: "e1", name: "MSS 2026", status: "open" }];
    if (path === "/admin/users" && init?.method === "POST") return {};
    if (/^\/admin\/users\/u\d$/.test(path) && init?.method === "PATCH") return {};
    return [];
  });
}

describe("Users", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it("lists users with their role", async () => {
    setup();
    renderWithProviders(<Users language="en" />);
    expect(await screen.findByText("mario@example.com")).toBeInTheDocument();
    expect(screen.getByText("admin@example.com")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("shows the empty state when there are no users", async () => {
    setup([]);
    renderWithProviders(<Users language="en" />);
    expect(await screen.findByText("No users")).toBeInTheDocument();
  });

  it("shows a toast if loading users fails", async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/admin/users") throw new Error("Forbidden");
      return [];
    });
    renderWithProviders(<Users language="en" />);
    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
  });

  it("requires an 8+ chars password before the create button is enabled", async () => {
    setup();
    const user = userEvent.setup();
    renderWithProviders(<Users language="en" />);
    await screen.findByText("mario@example.com");
    await user.click(screen.getByRole("button", { name: "Create user" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = () => Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Create user") as HTMLButtonElement;
    await user.type(dialog.querySelector('input[type="email"]') as HTMLInputElement, "new@example.com");
    await user.type(dialog.querySelector('input[type="password"]') as HTMLInputElement, "short");
    expect(confirm()).toBeDisabled();
    await user.type(dialog.querySelector('input[type="password"]') as HTMLInputElement, "12345");
    expect(confirm()).toBeEnabled();
  });

  it("creates a user with trimmed email and reloads the list", async () => {
    setup();
    const user = userEvent.setup();
    renderWithProviders(<Users language="en" />);
    await screen.findByText("mario@example.com");
    await user.click(screen.getByRole("button", { name: "Create user" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(dialog.querySelector('input[type="email"]') as HTMLInputElement, " new@example.com ");
    await user.type(dialog.querySelector('input[type="password"]') as HTMLInputElement, "password1");
    await user.click(Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Create user")!);
    await waitFor(() => expect(apiMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(true));
    const post = apiMock.mock.calls.find((c) => c[1]?.method === "POST")!;
    expect(post[0]).toBe("/admin/users");
    expect(JSON.parse(post[1].body)).toMatchObject({ email: "new@example.com", password: "password1", role: "user", country: null, publicProfile: false });
    await waitFor(() => expect(apiMock.mock.calls.filter((c) => c[0] === "/admin/users" && !c[1]).length).toBe(2));
  });

  it("shows a specific message on 409 email conflict", async () => {
    setup();
    apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/admin/users" && init?.method === "POST") throw new ApiError(409, "dup");
      if (path === "/admin/users") return users;
      return [];
    });
    const user = userEvent.setup();
    renderWithProviders(<Users language="en" />);
    await screen.findByText("mario@example.com");
    await user.click(screen.getByRole("button", { name: "Create user" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(dialog.querySelector('input[type="email"]') as HTMLInputElement, "mario@example.com");
    await user.type(dialog.querySelector('input[type="password"]') as HTMLInputElement, "password1");
    await user.click(Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Create user")!);
    expect(await screen.findByText("Email already registered.")).toBeInTheDocument();
  });

  it("toggling the active switch sends PATCH with the inverted value", async () => {
    setup();
    const user = userEvent.setup();
    renderWithProviders(<Users language="en" />);
    await screen.findByText("mario@example.com");
    const switches = screen.getAllByRole("checkbox");
    await user.click(switches[0]); // u1 is active -> deactivate
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/admin/users/u1", { method: "PATCH", body: JSON.stringify({ isActive: false }) }));
  });

  it("export buttons stay disabled until an event is chosen", async () => {
    setup();
    renderWithProviders(<Users language="en" />);
    await screen.findByText("mario@example.com");
    expect(screen.getByRole("button", { name: "Excel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "PDF" })).toBeDisabled();
  });

  describe("error handling", () => {
    let unhandled: unknown[];
    const onUnhandled = (e: unknown) => { unhandled.push(e); };
    beforeEach(() => {
      unhandled = [];
      process.on("unhandledRejection", onUnhandled);
    });
    afterEach(() => {
      process.off("unhandledRejection", onUnhandled);
    });

    const profile = { id: "u1", email: "mario@example.com", role: "user", isActive: true, firstName: "Mario" };

    function setupWith(failing: (path: string, init?: RequestInit) => string | null) {
      apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
        const msg = failing(path, init);
        if (msg) throw new Error(msg);
        if (path === "/admin/users" && !init) return users;
        if (path === "/events") return [];
        if (path === "/admin/users/u1/profile" && !init) return profile;
        return {};
      });
    }

    async function flush() {
      await new Promise((r) => setTimeout(r, 20));
      expect(unhandled).toEqual([]);
    }

    it("shows a toast and leaves the switch unchanged when toggling active fails", async () => {
      setupWith((path, init) => (init?.method === "PATCH" ? "Toggle refused" : null));
      const user = userEvent.setup();
      renderWithProviders(<Users language="en" />);
      await screen.findByText("mario@example.com");
      const sw = screen.getAllByRole("checkbox")[0];
      await user.click(sw);
      expect(await screen.findByText("Toggle refused")).toBeInTheDocument();
      expect(sw).toBeChecked();
      await flush();
    });

    it("shows a toast when opening the edit dialog fails", async () => {
      setupWith((path) => (path === "/admin/users/u1/profile" ? "Profile unavailable" : null));
      const user = userEvent.setup();
      renderWithProviders(<Users language="en" />);
      await user.click(await screen.findByText("mario@example.com"));
      expect(await screen.findByText("Profile unavailable")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await flush();
    });

    it("shows a toast when reset password fails", async () => {
      setupWith((path) => (path.endsWith("/reset-password") ? "Reset failed" : null));
      const user = userEvent.setup();
      renderWithProviders(<Users language="en" />);
      await user.click(await screen.findByText("mario@example.com"));
      await user.click(await screen.findByRole("button", { name: "Reset password" }));
      expect(await screen.findByText("Reset failed")).toBeInTheDocument();
      await flush();
    });

    it("shows a toast when saving the profile fails and keeps the edit form open", async () => {
      setupWith((path, init) => (path === "/admin/users/u1/profile" && init?.method === "PUT" ? "Save failed" : null));
      const user = userEvent.setup();
      renderWithProviders(<Users language="en" />);
      await user.click(await screen.findByText("mario@example.com"));
      await user.click(await screen.findByRole("button", { name: "Edit" }));
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByText("Save failed")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
      await flush();
    });

    it("shows a toast and keeps the role when updating the role fails", async () => {
      setupWith((path, init) => (init?.method === "PATCH" ? "Role refused" : null));
      const user = userEvent.setup();
      renderWithProviders(<Users language="en" />);
      await user.click(await screen.findByText("mario@example.com"));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getAllByRole("combobox")[0]);
      await user.click(await screen.findByRole("option", { name: "staff" }));
      expect(await screen.findByText("Role refused")).toBeInTheDocument();
      expect(within(dialog).getAllByRole("combobox")[0]).toHaveTextContent("user");
      await flush();
    });
  });
});
