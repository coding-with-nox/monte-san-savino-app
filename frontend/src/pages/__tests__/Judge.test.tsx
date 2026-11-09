import React from "react";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

describe("Judge completion", () => {
  const judged = (id: string, userId: string, categoryId: string, n: number) =>
    ({ ...base, id, code: n, displayNumber: n, categoryId, categoryName: categoryId, currentRank: 2, userId, name: id });
  let completionCalls: string[];
  let completionImpl: (path: string) => Promise<any>;
  let completeImpl: () => Promise<any>;
  let allModels: any[];

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    completionCalls = [];
    completionImpl = async () => ({ allDone: false, totalJudges: 2, completedJudges: 1 });
    completeImpl = async () => ({ completed: true, allDone: false, totalJudges: 2, completedJudges: 1 });
    // c1 fully judged; c2 has an unjudged model. The mock ignores categoryId like an old backend.
    allModels = [judged("a", "u1", "c1", 1), { ...judged("b", "u2", "c2", 2), currentRank: null }];
    apiMock.mockReset();
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/judge/events") return [{ eventId: "e1", eventName: "MSS 2026" }];
      if (path.startsWith("/public/categories")) return [{ id: "c1", name: "Historical" }, { id: "c2", name: "Sci-Fi" }];
      if (path.startsWith("/judge/models")) return allModels;
      if (path.endsWith("/complete")) return completeImpl();
      if (path.endsWith("/completion")) { completionCalls.push(path); return completionImpl(path); }
      return {};
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function selectCategory(user: ReturnType<typeof userEvent.setup>, name: string) {
    await screen.findByText("MSS 2026");
    const boxes = screen.getAllByRole("combobox");
    await user.click(boxes[1]);
    await user.click(await screen.findByRole("option", { name }));
  }

  async function startPolling(user: ReturnType<typeof userEvent.setup>) {
    renderWithProviders(<Judge language="en" />);
    await selectCategory(user, "Historical");
    await user.click(await screen.findByRole("button", { name: "Judging Complete" }));
    await screen.findByText(/Waiting for other judges/);
  }

  it("computes 'all judged' on the selected category only", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<Judge language="en" />);
    await selectCategory(user, "Historical");
    expect(await screen.findByRole("button", { name: "Judging Complete" })).toBeInTheDocument();
    await selectCategory(user, "Sci-Fi");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Judging Complete" })).not.toBeInTheDocument());
  });

  it("stops polling when the category changes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await startPolling(user);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(completionCalls.length).toBe(1);
    await selectCategory(user, "Sci-Fi");
    const before = completionCalls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
    expect(completionCalls.length).toBe(before);
    expect(screen.queryByText(/Waiting for other judges/)).not.toBeInTheDocument();
  });

  it("ignores a late completion response after the category changed", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let release: (v: any) => void = () => {};
    completionImpl = () => new Promise((r) => { release = r; });
    await startPolling(user);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(completionCalls.length).toBe(1);
    await selectCategory(user, "Sci-Fi");
    await act(async () => { release({ allDone: true, totalJudges: 2, completedJudges: 2 }); });
    expect(screen.queryByText("All judges have completed")).not.toBeInTheDocument();
    expect(screen.queryByText(/Waiting for other judges/)).not.toBeInTheDocument();
  });

  it("pauses polling while the tab is hidden and shows a non-blocking error on failures", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await startPolling(user);
    const vis = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(completionCalls.length).toBe(0);
    vis.mockReturnValue("visible");
    completionImpl = async () => { throw new Error("network"); };
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(await screen.findByText(/Unable to refresh the judges/)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for other judges/)).toBeInTheDocument();
    vis.mockRestore();
  });

  it("shows the backend message on 409", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    completeImpl = async () => { throw Object.assign(new Error("3 models not voted yet"), { status: 409 }); };
    renderWithProviders(<Judge language="en" />);
    await selectCategory(user, "Historical");
    await user.click(await screen.findByRole("button", { name: "Judging Complete" }));
    expect(await screen.findByText("3 models not voted yet")).toBeInTheDocument();
  });

  it("shows a clear message on 403/404 for unassigned categories", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    completeImpl = async () => { throw Object.assign(new Error("Forbidden"), { status: 403 }); };
    renderWithProviders(<Judge language="en" />);
    await selectCategory(user, "Historical");
    await user.click(await screen.findByRole("button", { name: "Judging Complete" }));
    expect(await screen.findByText(/not assigned to you/)).toBeInTheDocument();
  });
});
