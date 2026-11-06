import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));
vi.mock("../../lib/download", () => ({ downloadAuthenticatedFile: vi.fn() }));
vi.mock("../../lib/auth", () => ({
  getRole: () => "admin",
  roleAtLeast: (actual: string, min: string) => {
    const order = ["user", "staff", "judge", "manager", "admin"];
    return order.indexOf(actual) >= order.indexOf(min);
  }
}));

import Admin from "../Admin";

describe("Admin (smoke)", () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockImplementation(async (path: string) => {
      if (path.startsWith("/public/events") || path === "/events")
        return [{ id: "e1", name: "MSS 2026", status: "open" }];
      return [];
    });
  });

  it("renders the tabs and the events from the API", async () => {
    renderWithProviders(<MemoryRouter><Admin language="en" /></MemoryRouter>);
    expect(await screen.findAllByRole("tab")).toHaveLength(5);
    expect((await screen.findAllByText("MSS 2026")).length).toBeGreaterThan(0);
  });

  it("switches tab without crashing", async () => {
    const user = userEvent.setup();
    renderWithProviders(<MemoryRouter><Admin language="en" /></MemoryRouter>);
    const tabs = await screen.findAllByRole("tab");
    await user.click(tabs[1]);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    await user.click(tabs[4]);
    expect(tabs[4]).toHaveAttribute("aria-selected", "true");
  });
});
