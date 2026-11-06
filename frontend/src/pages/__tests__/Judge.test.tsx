import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));

import Judge from "../Judge";

const base = { imageUrl: null, voteCount: 0, description: null };
let models: any[];

function setup() {
  apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/judge/events") return [{ eventId: "e1", eventName: "MSS 2026" }];
    if (path.startsWith("/public/categories")) return [{ id: "c1", name: "Historical" }];
    if (path.startsWith("/judge/models")) return models;
    if (path === "/judge/vote") return {};
    return {};
  });
}

describe("Judge", () => {
  beforeEach(() => {
    apiMock.mockReset();
    models = [
      { ...base, id: "m1", code: 12, displayNumber: 12, categoryId: "c1", categoryName: "Historical", currentRank: null, userId: "u1", name: "Marine", notes: "painted by hand" },
      { ...base, id: "m2", code: 15, displayNumber: 15, categoryId: "c1", categoryName: "Historical", currentRank: null, userId: "u1", name: "Dread" },
      { ...base, id: "m3", code: 7, displayNumber: 7, categoryId: "c1", categoryName: "Historical", currentRank: 3, userId: "u2", name: "Orc" }
    ];
    setup();
  });

  it("groups models per exhibitor using the lowest number and hides fully judged ones", async () => {
    renderWithProviders(<Judge language="en" />);
    expect(await screen.findByText("12")).toBeInTheDocument(); // u1: min(12,15)
    expect(screen.queryByText("15")).not.toBeInTheDocument();
    expect(screen.queryByText("7")).not.toBeInTheDocument(); // u2 already judged
  });

  it("shows already judged exhibitors with the show-all switch", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Judge language="en" />);
    await screen.findByText("12");
    await user.click(screen.getByRole("checkbox"));
    expect(await screen.findByText("7")).toBeInTheDocument();
  });

  it("filters exhibitors by number", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Judge language="en" />);
    await screen.findByText("12");
    await user.click(screen.getByRole("checkbox"));
    await user.type(screen.getByLabelText(/exhibit/i), "7");
    await waitFor(() => expect(screen.queryByText("12")).not.toBeInTheDocument());
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("opens the score screen, shows notes and submits one vote per model", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Judge language="en" />);
    await user.click(await screen.findByText("12"));
    expect(screen.getByText(/painted by hand/)).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Submit Your Score" });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^4/ }));
    expect(submit).toBeEnabled();
    await user.click(submit);
    await waitFor(() => expect(apiMock.mock.calls.filter((c) => c[0] === "/judge/vote").length).toBe(2));
    const bodies = apiMock.mock.calls.filter((c) => c[0] === "/judge/vote").map((c) => JSON.parse(c[1].body));
    expect(bodies).toEqual([{ modelId: "m1", rank: 4 }, { modelId: "m2", rank: 4 }]);
    expect(await screen.findByText("Vote recorded.")).toBeInTheDocument();
  });

  it("pluralizes the selection hint in English and Italian", async () => {
    const user = userEvent.setup();
    const view = renderWithProviders(<Judge language="en" />);
    await user.click(await screen.findByText("12"));
    expect(screen.getByText("All models (2)")).toBeInTheDocument();
    await user.click(screen.getByText(/15\s+Dread/));
    expect(screen.getByText("1 model selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByText("2 models selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deselect all" })).toBeInTheDocument();
    view.unmount();

    renderWithProviders(<Judge language="it" />);
    await user.click(await screen.findByText("12"));
    expect(screen.getByText("Tutti i modelli (2)")).toBeInTheDocument();
    await user.click(screen.getByText(/15\s+Dread/));
    expect(screen.getByText("1 modello selezionato")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Seleziona tutti" }));
    expect(screen.getByText("2 modelli selezionati")).toBeInTheDocument();
  });

  it("votes only for the selected model in individual mode", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Judge language="en" />);
    await user.click(await screen.findByText("12"));
    await user.click(screen.getByText(/15\s+Dread/)); // switches to individual mode selecting m2
    await user.click(screen.getByRole("button", { name: /^2/ }));
    await user.click(screen.getByRole("button", { name: "Submit Your Score" }));
    await waitFor(() => expect(apiMock.mock.calls.filter((c) => c[0] === "/judge/vote").length).toBe(1));
    expect(JSON.parse(apiMock.mock.calls.find((c) => c[0] === "/judge/vote")![1].body)).toEqual({ modelId: "m2", rank: 2 });
  });

  it("shows the error and does not leave the score screen when a vote fails", async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/judge/events") return [{ eventId: "e1", eventName: "MSS 2026" }];
      if (path.startsWith("/judge/models")) return models;
      if (path === "/judge/vote") throw new Error("Voting closed");
      return [];
    });
    const user = userEvent.setup();
    renderWithProviders(<Judge language="en" />);
    await user.click(await screen.findByText("12"));
    await user.click(screen.getByRole("button", { name: /^1/ }));
    await user.click(screen.getByRole("button", { name: "Submit Your Score" }));
    expect(await screen.findByText("Voting closed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Your Score" })).toBeInTheDocument();
  });

  it("shows the toast when events fail to load", async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/judge/events") throw new Error("No judge assignment");
      return [];
    });
    renderWithProviders(<Judge language="en" />);
    expect(await screen.findByText("No judge assignment")).toBeInTheDocument();
  });
});
