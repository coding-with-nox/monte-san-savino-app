import React from "react";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { MemoryRouter, useLocation, useNavigationType } from "react-router-dom";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));

import Judge from "../Judge";

// Anonymous display shape served by GET /judge/displays (no owner, no display-level vote field).
const model = (id: string, name: string, code: number, currentRank: number | null = null, extra: Record<string, unknown> = {}) => ({
  id, name, code, categoryId: "c1", categoryName: "Historical", categoryStatus: "open", imageUrl: null, currentRank, ...extra,
});
const display = (displayNumber: number, models: any[], extra: Record<string, unknown> = {}) => ({
  displayNumber,
  categoryId: "c1",
  categoryName: "Historical",
  categoryStatus: "open",
  judged: models.every((m) => m.currentRank !== null),
  issues: [] as string[],
  models,
  ...extra,
});

let displays: any[];
let phase: string;
let discordantModelIds: string[];

/** Mirrors the backend: a whole-display vote sets every model and marks the display judged. */
function applyDisplayVote(body: { displayNumber: number; rank: number }) {
  const target = displays.find((d) => d.displayNumber === body.displayNumber);
  if (!target) return;
  target.models.forEach((m: any) => { m.currentRank = body.rank; });
  target.judged = true;
}

function setup() {
  apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/judge/events") return [{ eventId: "e1", eventName: "MSS 2026" }];
    if (path.startsWith("/public/categories")) return [{ id: "c1", name: "Historical" }];
    if (path === "/judge/displays/vote") {
      applyDisplayVote(JSON.parse(init!.body as string));
      return { skippedClosedModelIds: [] };
    }
    // copies, like a real response: React must see a new array after each refresh
    if (path.startsWith("/judge/displays")) return JSON.parse(JSON.stringify(displays));
    if (path.endsWith("/completion")) return { allDone: false, totalJudges: 2, completedJudges: 1, phase, discordantModelIds };
    if (path === "/judge/vote") return {};
    return {};
  });
}

async function pickCategory(user: ReturnType<typeof userEvent.setup>, name: string) {
  await screen.findByText("MSS 2026");
  await user.click(screen.getAllByRole("combobox")[1]);
  await user.click(await screen.findByRole("option", { name }));
}

/** Exposes the current query string and the last navigation type (REPLACE = no history entry). */
function LocationProbe() {
  const location = useLocation();
  const navType = useNavigationType();
  return (
    <>
      <span data-testid="search">{location.search}</span>
      <span data-testid="nav-type">{navType}</span>
    </>
  );
}

function renderJudge(language: "it" | "en", url = "/judge") {
  return renderWithProviders(
    <MemoryRouter initialEntries={[url]}>
      <Judge language={language} />
      <LocationProbe />
    </MemoryRouter>
  );
}

describe("Judge", () => {
  beforeEach(() => {
    apiMock.mockReset();
    displays = [
      display(12, [model("m1", "Marine", 12, null, { notes: "painted by hand" }), model("m2", "Dread", 15)]),
      display(7, [model("m3", "Orc", 7, 3)]), // already judged by this judge
    ];
    phase = "judging";
    discordantModelIds = [];
    setup();
  });

  it("shows one anonymous tile per display and hides judged displays", async () => {
    renderJudge("en");
    expect(await screen.findByRole("button", { name: "Display 12 (2)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Display 7/ })).not.toBeInTheDocument();
    // no owner or model names on the tiles
    expect(screen.queryByText("Dread")).not.toBeInTheDocument();
  });

  it("shows judged displays with their vote when 'show all' is on", async () => {
    const user = userEvent.setup();
    renderJudge("en");
    await screen.findByRole("button", { name: "Display 12 (2)" });
    await user.click(screen.getByRole("checkbox"));
    expect(await screen.findByRole("button", { name: "Display 7 (1)" })).toBeInTheDocument();
  });

  it("filters displays by number", async () => {
    const user = userEvent.setup();
    renderJudge("en");
    await screen.findByRole("button", { name: "Display 12 (2)" });
    await user.click(screen.getByRole("checkbox"));
    await user.type(screen.getByLabelText(/display number/i), "7");
    await waitFor(() => expect(screen.queryByRole("button", { name: /Display 12/ })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Display 7 (1)" })).toBeInTheDocument();
  });

  it("opens the score screen, shows notes and votes the whole display, then returns to the tiles", async () => {
    const user = userEvent.setup();
    renderJudge("en");
    await user.click(await screen.findByRole("button", { name: "Display 12 (2)" }));
    expect(screen.getByText(/painted by hand/)).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Score whole display (2)" });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^4/ }));
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(await screen.findByText("Vote recorded.")).toBeInTheDocument();
    // back on the tiles: the display is now judged and disappears
    await waitFor(() => expect(screen.queryByRole("button", { name: "Display 12 (2)" })).not.toBeInTheDocument());
    const calls = apiMock.mock.calls.filter((c) => c[0] === "/judge/displays/vote");
    expect(calls.map((c) => JSON.parse(c[1].body))).toEqual([{ eventId: "e1", displayNumber: 12, rank: 4 }]);
    expect(apiMock.mock.calls.some((c) => c[0] === "/judge/vote")).toBe(false);
  });

  it("pluralizes the selection hint in English and Italian", async () => {
    const user = userEvent.setup();
    const view = renderJudge("en");
    await user.click(await screen.findByRole("button", { name: "Display 12 (2)" }));
    expect(screen.getByText("All models (2)")).toBeInTheDocument();
    await user.click(screen.getByText(/15\s+Dread/));
    expect(screen.getByText("1 model selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByText("2 models selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deselect all" })).toBeInTheDocument();
    view.unmount();

    renderJudge("it");
    await user.click(await screen.findByRole("button", { name: "Display 12 (2)" }));
    expect(screen.getByText("Tutti i modelli (2)")).toBeInTheDocument();
    await user.click(screen.getByText(/15\s+Dread/));
    expect(screen.getByText("1 modello selezionato")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Seleziona tutti" }));
    expect(screen.getByText("2 modelli selezionati")).toBeInTheDocument();
  });

  it("votes only for the selected model in individual mode", async () => {
    const user = userEvent.setup();
    renderJudge("en");
    await user.click(await screen.findByRole("button", { name: "Display 12 (2)" }));
    await user.click(screen.getByText(/15\s+Dread/)); // switches to individual mode selecting m2
    await user.click(screen.getByRole("button", { name: /^2/ }));
    await user.click(screen.getByRole("button", { name: "Submit Your Score" }));
    await waitFor(() => expect(apiMock.mock.calls.filter((c) => c[0] === "/judge/vote").length).toBe(1));
    expect(JSON.parse(apiMock.mock.calls.find((c) => c[0] === "/judge/vote")![1].body)).toEqual({ modelId: "m2", rank: 2 });
  });

  it("shows the error and does not leave the score screen when a vote fails", async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/judge/events") return [{ eventId: "e1", eventName: "MSS 2026" }];
      if (path === "/judge/displays/vote") throw new Error("Voting closed");
      if (path.startsWith("/judge/displays")) return displays;
      return [];
    });
    const user = userEvent.setup();
    renderJudge("en");
    await user.click(await screen.findByRole("button", { name: "Display 12 (2)" }));
    await user.click(screen.getByRole("button", { name: /^1/ }));
    await user.click(screen.getByRole("button", { name: "Score whole display (2)" }));
    expect(await screen.findByText("Voting closed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Score whole display (2)" })).toBeInTheDocument();
  });

  it("keeps two displays of the same participant apart", async () => {
    displays = [
      display(1, [model("a", "A", 1)]),
      display(2, [model("b", "B", 2)]),
    ];
    renderJudge("en");
    expect(await screen.findByRole("button", { name: "Display 1 (1)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Display 2 (1)" })).toBeInTheDocument();
  });

  it("shows the toast when events fail to load", async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/judge/events") throw new Error("No judge assignment");
      return [];
    });
    renderJudge("en");
    expect(await screen.findByText("No judge assignment")).toBeInTheDocument();
  });
});

describe("Judge phases", () => {
  beforeEach(() => {
    apiMock.mockReset();
    displays = [
      display(3, [model("m5", "Ork", 5, 1)], { judged: true, issues: ["DISCORDANT_VOTES"] }),
      display(5, [model("m6", "Gob", 6, 2)], { judged: true }),
      display(8, [model("m7", "Elf", 8, 4)], { judged: true }),
    ];
    phase = "reconciliation";
    discordantModelIds = ["m5"];
    setup();
  });

  it("in reconciliation shows only the displays with discordant votes, marked with an error", async () => {
    const user = userEvent.setup();
    renderJudge("en");
    await pickCategory(user, "Historical");
    expect(await screen.findByText("Phase 2 · reconciliation")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Display 3 (1)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Display 5 (1)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Display 8 (1)" })).not.toBeInTheDocument();
    expect(screen.getAllByTitle("The judges' votes on this display are too far apart: compare notes and correct them.").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("checkbox"));
    expect(await screen.findByRole("button", { name: "Display 5 (1)" })).toBeInTheDocument();
  });

  it("explains the discordance on the score screen of a display", async () => {
    const user = userEvent.setup();
    renderJudge("en");
    await pickCategory(user, "Historical");
    await user.click(await screen.findByRole("button", { name: "Display 3 (1)" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/too far apart/)).toBeInTheDocument();
  });

  it("closed class is read-only: no vote can be recorded", async () => {
    phase = "closed";
    const user = userEvent.setup();
    renderJudge("en");
    await pickCategory(user, "Historical");
    expect(await screen.findByText("Class closed")).toBeInTheDocument();
    // closed shows every display, judged or not
    await user.click(await screen.findByRole("button", { name: "Display 5 (1)" }));
    expect(screen.getByText(/votes are read-only/)).toBeInTheDocument();
    for (const score of ["0", "1", "2", "3", "4"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${score}`) })).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "Score whole display (1)" })).toBeDisabled();
    expect(apiMock.mock.calls.some((c) => c[0] === "/judge/displays/vote" || c[0] === "/judge/vote")).toBe(false);
  });
});

describe("Judge completion", () => {
  const judgedDisplay = (n: number, categoryId: string, rank: number | null) => ({
    displayNumber: n,
    categoryId,
    categoryName: categoryId,
    judged: rank !== null,
    issues: [],
    models: [{ id: `m${n}`, name: `M${n}`, code: n, imageUrl: null, currentRank: rank }],
  });
  let completionCalls: string[];
  let completionImpl: (path: string) => Promise<any>;
  let completeImpl: () => Promise<any>;
  let allDisplays: any[];

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    completionCalls = [];
    completionImpl = async () => ({ allDone: false, totalJudges: 2, completedJudges: 1 });
    completeImpl = async () => ({ completed: true, allDone: false, totalJudges: 2, completedJudges: 1 });
    // c1 fully judged; c2 has an unjudged display. The mock ignores categoryId like an old backend.
    allDisplays = [judgedDisplay(1, "c1", 2), judgedDisplay(2, "c2", null)];
    apiMock.mockReset();
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/judge/events") return [{ eventId: "e1", eventName: "MSS 2026" }];
      if (path.startsWith("/public/categories")) return [{ id: "c1", name: "Historical" }, { id: "c2", name: "Sci-Fi" }];
      if (path.startsWith("/judge/displays")) return allDisplays;
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
    renderJudge("en");
    await selectCategory(user, "Historical");
    await user.click(await screen.findByRole("button", { name: "Judging Complete" }));
    await screen.findByText(/Waiting for other judges/);
    completionCalls.length = 0; // count only the polls from here on
  }

  it("computes 'all judged' on the selected category only", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderJudge("en");
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
    // 1st call: phase on category selection (immediate). 2nd call: the first poll (held open).
    let calls = 0;
    completionImpl = () => {
      calls++;
      return calls === 2
        ? new Promise((r) => { release = r; })
        : Promise.resolve({ allDone: false, totalJudges: 2, completedJudges: 1 });
    };
    await startPolling(user);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(completionCalls.length).toBe(1);
    await selectCategory(user, "Sci-Fi");
    await act(async () => { release({ allDone: true, totalJudges: 2, completedJudges: 2 }); });
    expect(screen.queryByText("All judges completed")).not.toBeInTheDocument();
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
    renderJudge("en");
    await selectCategory(user, "Historical");
    await user.click(await screen.findByRole("button", { name: "Judging Complete" }));
    expect(await screen.findByText("3 models not voted yet")).toBeInTheDocument();
  });

  it("shows a clear message on 403/404 for unassigned categories", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    completeImpl = async () => { throw Object.assign(new Error("Forbidden"), { status: 403 }); };
    renderJudge("en");
    await selectCategory(user, "Historical");
    await user.click(await screen.findByRole("button", { name: "Judging Complete" }));
    expect(await screen.findByText(/not assigned to you/)).toBeInTheDocument();
  });
});

describe("Judge deep link (?eventId&categoryId)", () => {
  beforeEach(() => {
    apiMock.mockReset();
    displays = [display(12, [model("m1", "Marine", 12)])];
    phase = "judging";
    discordantModelIds = [];
    setup();
  });

  it("preselects the event and class from the URL", async () => {
    renderJudge("en", "/judge?eventId=e1&categoryId=c1");
    expect(await screen.findByRole("button", { name: "Display 12 (1)" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("combobox")[1]).toHaveTextContent("Historical"));
    expect(apiMock).toHaveBeenCalledWith("/judge/displays?eventId=e1&categoryId=c1");
  });

  it("ignores an event and a class the judge is not assigned to", async () => {
    renderJudge("en", "/judge?eventId=foreign&categoryId=c1");
    expect(await screen.findByRole("button", { name: "Display 12 (1)" })).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith("/judge/displays?eventId=e1");
    expect(apiMock).not.toHaveBeenCalledWith(expect.stringContaining("categoryId=c1"));
    expect(screen.getAllByRole("combobox")[1]).not.toHaveTextContent("Historical");
  });

  it("keeps the URL in step with the chosen class, replacing the history entry", async () => {
    const user = userEvent.setup();
    renderJudge("en", "/judge");
    await pickCategory(user, "Historical");
    await waitFor(() => expect(screen.getByTestId("search")).toHaveTextContent(/^\?eventId=e1&categoryId=c1$/));
    expect(screen.getByTestId("nav-type")).toHaveTextContent("REPLACE");
  });
});
