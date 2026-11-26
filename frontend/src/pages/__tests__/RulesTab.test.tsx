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
