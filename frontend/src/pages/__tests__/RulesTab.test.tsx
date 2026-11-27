import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));

import RulesTab from "../admin/RulesTab";

const body = (path: string) =>
  JSON.parse(apiMock.mock.calls.find((c) => c[0] === path && c[1]?.method === "PUT")![1].body);

describe("Admin rules tab", () => {
  beforeEach(() => {
    apiMock.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === "PUT") return { updated: true };
      if (path === "/settings") return { baseFeeCents: "2500" };
      if (path === "/admin/settings/section-visibility")
        return { sections: ["stats"], roles: ["jury_president", "admin"], visibility: { jury_president: [], admin: ["stats"] } };
      if (path === "/settings/prize-order") return { order: ["Bronze", "Silver", "Gold"] };
      return {};
    });
  });

  it("saves base fee, visibility matrix and prize order", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesTab language="en" />);
    await waitFor(() => expect(screen.getByLabelText("Base fee in euros")).toHaveValue("25"));
    const [saveFee, saveMatrix, saveOrder] = await screen.findAllByRole("button", { name: "Save" });
    await user.click(saveFee);
    await user.click(screen.getByRole("checkbox", { name: "Jury president: Statistics" }));
    await user.click(saveMatrix);
    await user.click(screen.getByRole("button", { name: "Move up: Gold" }));
    await user.click(saveOrder);
    expect(body("/admin/settings")).toEqual({ baseFeeCents: "2500" });
    expect(body("/admin/settings/section-visibility")).toEqual({ visibility: { jury_president: ["stats"] } });
    expect(body("/admin/settings/prize-order")).toEqual({ order: ["Bronze", "Gold", "Silver"] });
  });
});

describe("Admin rules tab: permissions matrix", () => {
  beforeEach(() => {
    apiMock.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === "PUT") return { updated: true };
      if (path === "/settings") return {};
      if (path === "/admin/settings/section-visibility")
        return {
          sections: ["stats"],
          roles: ["staff", "manager", "admin"],
          visibility: { staff: [], manager: ["stats"], admin: ["stats"] },
          permissions: { staff: [], manager: ["enrollOnBehalf"] },
          availablePermissions: ["enrollOnBehalf"]
        };
      return {};
    });
  });

  it("shows admin as always granted and saves the permissions of the other roles", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesTab language="en" />);
    const box = (role: string) => screen.getByRole("checkbox", { name: `${role}: Enroll models on behalf of others` });
    expect(await screen.findByText("Permissions")).toBeInTheDocument();
    expect(box("admin")).toBeChecked();
    expect(box("admin")).toBeDisabled();
    expect(box("manager")).toBeChecked();
    expect(box("staff")).not.toBeChecked();

    await user.click(box("staff"));
    await user.click(box("manager"));
    await user.click(screen.getAllByRole("button", { name: "Save" })[1]);
    expect(body("/admin/settings/section-visibility")).toEqual({
      visibility: { staff: [], manager: ["stats"] },
      permissions: { staff: ["enrollOnBehalf"], manager: [] }
    });
  });
});

describe("Admin rules tab: registrations card", () => {
  beforeEach(() => {
    apiMock.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === "PUT") return { updated: true };
      if (path === "/settings")
        return { registrationStatus: "closed", defaultPublicPage: "register", lockLevelToFirstSelection: "false", levelUpWarning: "true" };
      if (path === "/admin/settings/section-visibility")
        return { sections: ["stats"], roles: ["admin"], visibility: { admin: ["stats"] } };
      return {};
    });
  });

  it("shows the current registration settings and explains the closed status", async () => {
    renderWithProviders(<RulesTab language="en" />);
    expect(await screen.findByRole("combobox", { name: /registration status/i })).toHaveTextContent("Closed");
    expect(screen.getByText("No new sign-ups or model entries from users.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /default sign-in page tab/i })).toHaveTextContent("Sign up");
    expect(screen.getByRole("checkbox", { name: "Lock level to first selection" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Move-up to Masters warning" })).toBeChecked();
  });

  it("saves status, default page and both level rules in one PUT", async () => {
    const user = userEvent.setup();
    renderWithProviders(<RulesTab language="en" />);
    await user.click(await screen.findByRole("combobox", { name: /registration status/i }));
    await user.click(await screen.findByRole("option", { name: "Event day" }));
    await user.click(screen.getByRole("combobox", { name: /default sign-in page tab/i }));
    await user.click(await screen.findByRole("option", { name: "Sign in" }));
    await user.click(screen.getByRole("checkbox", { name: "Lock level to first selection" }));
    await user.click(screen.getByRole("checkbox", { name: "Move-up to Masters warning" }));
    await user.click(screen.getAllByRole("button", { name: "Save" }).at(-1)!);

    const puts = apiMock.mock.calls.filter((c) => c[0] === "/admin/settings" && c[1]?.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(JSON.parse(puts[0][1].body)).toEqual({
      registrationStatus: "openday",
      defaultPublicPage: "login",
      lockLevelToFirstSelection: "true",
      levelUpWarning: "false"
    });
  });
});
