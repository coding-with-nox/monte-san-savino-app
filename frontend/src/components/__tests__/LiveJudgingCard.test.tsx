import React from "react";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ api: (...a: unknown[]) => apiMock(...a) }));

import LiveJudgingCard, { LIVE_POLL_MS } from "../LiveJudgingCard";

const live = {
  updatedAt: "2026-11-27T10:00:00Z",
  totals: { classes: 2, closed: 1, models: 9, votesCast: 12, votesExpected: 20, percent: 60, medals: { Gold: 1, "Highly Commended": 2 } },
  classes: [
    {
      categoryId: "c2", name: "Armor", classNumber: 2, presentationOrder: 2, phase: "closed", models: 4,
      votesCast: 8, votesExpected: 8, percent: 100, judgesTotal: 2, judgesCompleted: 2, discordant: 0, medals: { Gold: 1 }
    },
    {
      categoryId: "c1", name: "Diorama", classNumber: 1, presentationOrder: 1, phase: "judging", models: 5,
      votesCast: 4, votesExpected: 12, percent: 33, judgesTotal: 3, judgesCompleted: 1, discordant: 2, medals: { "Highly Commended": 2 }
    }
  ]
};

/** Simulates the browser switching the page between visible and hidden. */
function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

const liveCalls = () => apiMock.mock.calls.filter(([path]) => String(path).includes("/live")).length;

describe("LiveJudgingCard", () => {
  beforeEach(() => {
    apiMock.mockReset().mockResolvedValue(live);
  });
  afterEach(() => {
    vi.useRealTimers();
    setVisibility("visible");
  });

  it("renders totals and one tile per class with phase, percent and discordant badge", async () => {
    renderWithProviders(<LiveJudgingCard language="en" eventId="e1" />);
    expect(apiMock).toHaveBeenCalledWith("/awards/events/e1/live");

    const totals = await screen.findByTestId("live-totals");
    expect(within(totals).getByText("Votes 12/20 · 60%")).toBeInTheDocument();
    expect(within(totals).getByText("Closed classes 1/2")).toBeInTheDocument();

    // Classes come in presentation order.
    const tiles = screen.getAllByTestId(/^live-class-/);
    expect(tiles.map((el) => el.getAttribute("data-testid"))).toEqual(["live-class-c1", "live-class-c2"]);

    const open = screen.getByTestId("live-class-c1");
    expect(within(open).getByText("Diorama")).toBeInTheDocument();
    expect(within(open).getByText("Judging")).toBeInTheDocument();
    expect(within(open).getByText("33%")).toBeInTheDocument();
    expect(within(open).getByText("Votes 4/12")).toBeInTheDocument();
    expect(within(open).getByText("Judges 1/3")).toBeInTheDocument();
    expect(within(open).getByTestId("live-discordant-c1")).toHaveTextContent("2 discordant");
    // Open class: its medals are projected.
    expect(within(open).getByText("projected", { exact: false })).toBeInTheDocument();

    const closed = screen.getByTestId("live-class-c2");
    expect(within(closed).getByText("Closed")).toBeInTheDocument();
    expect(within(closed).queryByTestId("live-discordant-c2")).not.toBeInTheDocument();
    expect(within(closed).queryByText("projected", { exact: false })).not.toBeInTheDocument();
  });

  it("hides classes without models until asked", async () => {
    apiMock.mockReset().mockResolvedValue({
      ...live,
      classes: [...live.classes, { ...live.classes[0], categoryId: "c3", name: "Empty", presentationOrder: 3, models: 0, phase: "judging" }]
    });
    renderWithProviders(<LiveJudgingCard language="en" eventId="e1" />);
    await screen.findByTestId("live-class-c1");
    expect(screen.queryByTestId("live-class-c3")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Show classes without models (1)" }));
    expect(screen.getByTestId("live-class-c3")).toBeInTheDocument();
  });

  it("shows the refresh time and refreshes on demand", async () => {
    renderWithProviders(<LiveJudgingCard language="en" eventId="e1" />);
    expect(await screen.findByText(/Updated at/)).toBeInTheDocument();
    const before = liveCalls();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(liveCalls()).toBe(before + 1);
  });

  it("refreshes every 15 seconds and pauses while the page is hidden", async () => {
    vi.useFakeTimers();
    renderWithProviders(<LiveJudgingCard language="en" eventId="e1" />);
    await act(async () => { await Promise.resolve(); });
    expect(liveCalls()).toBe(1);

    await act(async () => { vi.advanceTimersByTime(LIVE_POLL_MS); });
    expect(liveCalls()).toBe(2);

    setVisibility("hidden");
    await act(async () => { vi.advanceTimersByTime(LIVE_POLL_MS * 3); });
    expect(liveCalls()).toBe(2);

    // Back on the page: refreshes at once, then resumes the 15 s interval.
    setVisibility("visible");
    expect(liveCalls()).toBe(3);
    await act(async () => { vi.advanceTimersByTime(LIVE_POLL_MS); });
    expect(liveCalls()).toBe(4);
  });

  it("asks for an event before fetching anything", () => {
    renderWithProviders(<LiveJudgingCard language="en" eventId="" />);
    expect(screen.getByText("Select an event to follow live judging.")).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });
});
