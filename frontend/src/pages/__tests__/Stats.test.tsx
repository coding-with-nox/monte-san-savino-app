import React from "react";
import { screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ api: (...a: unknown[]) => apiMock(...a) }));

import Stats, { STATS_POLL_MS } from "../Stats";

const overview = {
  usersTotal: 12,
  usersByCountry: [{ country: "IT", count: 8 }, { country: "DE", count: 4 }],
  modelsPerUser: [{ userId: "u1", name: "Mario", count: 3 }],
  modelsPerCategory: [{ categoryId: "c1", name: "Armor", count: 7 }, { categoryId: "c2", name: "Air", count: 3 }],
  medals: [{ name: "Gold", count: 2 }],
  zeroModelUsers: [{ userId: "u9", name: "Luigi", email: "l@x.it" }],
  honorsSummary: []
};

describe("Stats", () => {
  beforeEach(() => { apiMock.mockReset().mockResolvedValue(overview); });
  afterEach(() => vi.useRealTimers());

  it("renders KPIs, classes and zero-model users with a profile link", async () => {
    renderWithProviders(<MemoryRouter><Stats language="en" /></MemoryRouter>);
    expect(await screen.findByTestId("kpi-users")).toHaveTextContent("12");
    expect(screen.getByTestId("kpi-models")).toHaveTextContent("10");
    expect(screen.getByTestId("kpi-medals")).toHaveTextContent("2");
    expect(screen.getByText("Armor")).toBeInTheDocument();
    expect(screen.getByText("Italy")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open profile" })).toHaveAttribute("href", "/users?open=u9");
    expect(apiMock).toHaveBeenCalledWith("/admin/stats/overview");
  });

  it("shows special awards and highly commended totals", async () => {
    apiMock.mockResolvedValue({
      ...overview,
      honors: { total: 5, assigned: 2, list: [{ code: "bos", name: "Best of Show", exhibitor: "Rossi", categoryName: "Diorama", displayNumber: 12 }] },
      commendedTotal: 4
    });
    renderWithProviders(<MemoryRouter><Stats language="en" /></MemoryRouter>);
    expect(await screen.findByTestId("kpi-honors")).toHaveTextContent("2/5");
    expect(screen.getByTestId("kpi-commended")).toHaveTextContent("4");
    expect(screen.getByText("Special awards (2/5)")).toBeInTheDocument();
    expect(screen.getByText("Best of Show")).toBeInTheDocument();
    expect(screen.getByText("Rossi")).toBeInTheDocument();
  });

  it("reads the zero-model users in the { count, list } shape", async () => {
    apiMock.mockResolvedValue({
      ...overview,
      zeroModelUsers: { count: 1, list: [{ participantNumber: 7, name: "Anna", email: "anna@x.it" }] }
    });
    renderWithProviders(<MemoryRouter><Stats language="en" /></MemoryRouter>);
    expect(await screen.findByTestId("kpi-zero")).toHaveTextContent("1");
    expect(screen.getByText("Anna")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open profile" })).not.toBeInTheDocument();
  });

  it("polls every 30 seconds", async () => {
    vi.useFakeTimers();
    renderWithProviders(<MemoryRouter><Stats language="en" /></MemoryRouter>);
    await act(async () => { await Promise.resolve(); });
    const before = apiMock.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(STATS_POLL_MS); });
    expect(apiMock.mock.calls.length).toBe(before + 1);
  });

  it("toggles projection mode", async () => {
    renderWithProviders(<MemoryRouter><Stats language="en" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Projection mode" }));
    expect(screen.getByTestId("stats-projection")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("stats-projection")).not.toBeInTheDocument();
  });
});
