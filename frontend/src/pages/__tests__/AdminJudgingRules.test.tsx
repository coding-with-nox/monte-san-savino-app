import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));
const roleMock = vi.fn(() => "admin");
vi.mock("../../lib/auth", () => ({ getRole: () => roleMock() }));

import JudgingRulesCard from "../admin/JudgingRulesCard";
import BracketsCard from "../admin/BracketsCard";
import CategoriesCard from "../admin/CategoriesCard";
import AwardsTab from "../admin/AwardsTab";

const calls = (path: string, method: string) => apiMock.mock.calls.filter((c) => c[0] === path && c[1]?.method === method);

const MSS = [
  { id: "b0", eventId: "e1", medalLabel: "None", medalRank: 0, lowLimit: 0, highLimit: 0 },
  { id: "b1", eventId: "e1", medalLabel: "Highly Commended", medalRank: 1, lowLimit: 1, highLimit: 4 },
  { id: "b2", eventId: "e1", medalLabel: "Bronze", medalRank: 2, lowLimit: 5, highLimit: 7 },
  { id: "b3", eventId: "e1", medalLabel: "Silver", medalRank: 3, lowLimit: 8, highLimit: 10 },
  { id: "b4", eventId: "e1", medalLabel: "Gold", medalRank: 4, lowLimit: 11, highLimit: 12 }
];

describe("Admin judging rules card", () => {
  beforeEach(() => {
    roleMock.mockReturnValue("admin");
    apiMock.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === "PUT") return { updated: true };
      if (path === "/settings") return { maxVotesPerExhibitor: "3", maxVoteDifferent: "2" };
      return [];
    });
  });

  it("shows the stored rule with a live example and saves both keys", async () => {
    const user = userEvent.setup();
    renderWithProviders(<JudgingRulesCard language="en" />);
    const votes = await screen.findByLabelText("Votes per exhibit");
    await waitFor(() => expect(votes).toHaveValue(3));
    expect(screen.getByText("With 3 judges the score goes from 0 to 12: the award brackets must cover this whole range.")).toBeInTheDocument();
    expect(screen.getByText("With a max difference of 2: a gap of 2 is not flagged, a gap of 3 is.")).toBeInTheDocument();

    await user.clear(votes);
    await user.type(votes, "4");
    const diff = screen.getByLabelText("Max vote difference");
    await user.clear(diff);
    await user.type(diff, "5");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(calls("/admin/settings", "PUT")).toHaveLength(1));
    expect(calls("/admin/settings", "PUT")[0][1].body).toBe(JSON.stringify({ maxVotesPerExhibitor: "4", maxVoteDifferent: "5" }));
  });

  it("does not save out-of-range values", async () => {
    const user = userEvent.setup();
    renderWithProviders(<JudgingRulesCard language="en" />);
    const votes = await screen.findByLabelText("Votes per exhibit");
    await waitFor(() => expect(votes).toHaveValue(3));
    await user.clear(votes);
    await user.type(votes, "11");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(calls("/admin/settings", "PUT")).toHaveLength(0);
  });

  it("shows the server error when the save is refused", async () => {
    const user = userEvent.setup();
    apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === "PUT") throw new Error("maxVoteDifferent must be between 0 and 40");
      if (path === "/settings") return { maxVotesPerExhibitor: "3", maxVoteDifferent: "2" };
      return [];
    });
    renderWithProviders(<JudgingRulesCard language="en" />);
    const diff = await screen.findByLabelText("Max vote difference");
    await waitFor(() => expect(diff).toHaveValue(2));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("maxVoteDifferent must be between 0 and 40")).toBeInTheDocument();
  });

  it("shows the values read-only to non-admin users", async () => {
    roleMock.mockReturnValue("manager");
    renderWithProviders(<JudgingRulesCard language="en" />);
    await waitFor(() => expect(screen.getByLabelText("Votes per exhibit")).toHaveValue(3));
    expect(screen.getByLabelText("Votes per exhibit")).toBeDisabled();
    expect(screen.getByLabelText("Max vote difference")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByText("Only the administrator can change these values.")).toBeInTheDocument();
  });
});

describe("Admin brackets", () => {
  const data = { events: [{ id: "e1", name: "Event One" }] } as any;

  async function pickEvent(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Event One" }));
  }

  beforeEach(() => {
    apiMock.mockReset().mockImplementation(async (path: string) => {
      if (path === "/settings") return { maxVotesPerExhibitor: "3" };
      if (path.startsWith("/admin/award-brackets?")) return MSS;
      return [];
    });
  });

  it("asks for confirmation, then calls the MSS preset endpoint for the selected event", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BracketsCard language="en" data={data} />);
    const load = screen.getByRole("button", { name: "Load MSS values" });
    expect(load).toBeDisabled();

    await pickEvent(user);
    await user.click(screen.getByRole("button", { name: "Load MSS values" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/replaced with the MSS values/)).toBeInTheDocument();
    expect(calls("/admin/award-brackets/preset", "POST")).toHaveLength(0);

    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(calls("/admin/award-brackets/preset", "POST")).toHaveLength(1));
    expect(calls("/admin/award-brackets/preset", "POST")[0][1].body).toBe(JSON.stringify({ eventId: "e1" }));
  });

  it("edits a row inline and saves it with PUT", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BracketsCard language="en" data={data} />);
    await pickEvent(user);
    await user.click(await screen.findByRole("button", { name: "Edit Bronze" }));
    const row = screen.getByRole("button", { name: "Save" }).closest("tr") as HTMLElement;
    const [, , high] = within(row).getAllByRole("spinbutton");
    await user.clear(high);
    await user.type(high, "8");
    await user.click(within(row).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(calls("/admin/award-brackets/b2", "PUT")).toHaveLength(1));
    expect(calls("/admin/award-brackets/b2", "PUT")[0][1].body).toBe(
      JSON.stringify({ medalLabel: "Bronze", medalRank: 2, lowLimit: 5, highLimit: 8 })
    );
  });

  it("does not save a row whose low limit is above the high limit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BracketsCard language="en" data={data} />);
    await pickEvent(user);
    await user.click(await screen.findByRole("button", { name: "Edit Bronze" }));
    const row = screen.getByRole("button", { name: "Save" }).closest("tr") as HTMLElement;
    const [, low] = within(row).getAllByRole("spinbutton");
    await user.clear(low);
    await user.type(low, "9");
    await user.click(within(row).getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Invalid values: use whole numbers/)).toBeInTheDocument();
    expect(calls("/admin/award-brackets/b2", "PUT")).toHaveLength(0);
  });

  it("warns about overlapping ranges and uncovered scores", async () => {
    const user = userEvent.setup();
    const overlapping = [
      { id: "b1", eventId: "e1", medalLabel: "Silver", medalRank: 2, lowLimit: 7, highLimit: 10 },
      { id: "b2", eventId: "e1", medalLabel: "Bronze", medalRank: 3, lowLimit: 5, highLimit: 7 },
      { id: "b3", eventId: "e1", medalLabel: "Gold", medalRank: 4, lowLimit: 11, highLimit: 12 }
    ];
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/settings") return { maxVotesPerExhibitor: "3" };
      if (path.startsWith("/admin/award-brackets?")) return overlapping;
      return [];
    });
    renderWithProviders(<BracketsCard language="en" data={data} />);
    await pickEvent(user);
    expect(await screen.findByText("Overlapping ranges: Silver (7-10) / Bronze (5-7).")).toBeInTheDocument();
    expect(screen.getByText("Scores not assigned between 0 and 12: 0-4.")).toBeInTheDocument();
  });

  it("shows no coverage warning for the complete MSS set", async () => {
    const user = userEvent.setup();
    renderWithProviders(<BracketsCard language="en" data={data} />);
    await pickEvent(user);
    await screen.findByRole("button", { name: "Edit Gold" });
    expect(screen.queryByText(/Overlapping ranges/)).not.toBeInTheDocument();
    expect(screen.queryByText(/not assigned between/)).not.toBeInTheDocument();
  });
});

describe("Admin categories: closing", () => {
  const refresh = vi.fn();
  const data = {
    events: [{ id: "e1", name: "Event One" }],
    categories: [{ id: "c1", eventId: "e1", name: "Cat A", status: "open", freeToEnter: false }],
    refresh,
    eventName: () => "Event One"
  } as any;

  beforeEach(() => {
    refresh.mockReset();
    apiMock.mockReset().mockImplementation(async () => ({}));
  });

  it("asks for confirmation before closing and closes only after confirm", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesCard language="en" data={data} />);
    await user.click(screen.getByRole("button", { name: "Close" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/will receive Nothing/)).toBeInTheDocument();
    expect(calls("/categories/c1/status", "PATCH")).toHaveLength(0);

    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(calls("/categories/c1/status", "PATCH")).toHaveLength(1));
    expect(calls("/categories/c1/status", "PATCH")[0][1].body).toBe(JSON.stringify({ status: "closed" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("does not close the category when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CategoriesCard language="en" data={data} />);
    await user.click(screen.getByRole("button", { name: "Close" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(calls("/categories/c1/status", "PATCH")).toHaveLength(0);
  });
});

describe("Admin awards: issue chips", () => {
  const data = {
    events: [{ id: "e1", name: "Event One" }],
    modelName: (id: string) => id,
    eventName: () => "Event One",
    ensureModels: vi.fn(),
    categories: [],
    refresh: vi.fn()
  } as any;

  beforeEach(() => {
    apiMock.mockReset().mockImplementation(async (path: string) => {
      if (path === "/public/categories")
        return [
          { id: "c1", eventId: "e1", name: "Cat A", status: "closed" },
          { id: "c2", eventId: "e1", name: "Cat B", status: "open" }
        ];
      if (path === "/admin/award-brackets?eventId=e1") return MSS;
      if (path === "/awards/categories/c1/review")
        return {
          brackets: MSS,
          rows: [
            { modelId: "m1", name: "Model A", totalScore: 12, award: { id: "a1", medalLabel: "Gold", medalRank: 4 }, source: "aggregate", issues: ["PARTIAL_VOTES", "DISCORDANT_VOTES"], votes: [] },
            { modelId: "m2", name: "Model B", totalScore: 9, award: { id: "a2", medalLabel: null, medalRank: null }, source: "aggregate", votes: [] }
          ]
        };
      return [];
    });
  });

  it("renders one warning chip per issue, and nothing when issues are absent", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AwardsTab language="en" data={data} />);
    const [eventSelect] = (await screen.findAllByRole("combobox")).slice(-2);
    await user.click(eventSelect);
    await user.click(await screen.findByRole("option", { name: "Event One" }));
    await user.click(screen.getAllByRole("combobox").slice(-1)[0]);
    await user.click(await screen.findByRole("option", { name: "Cat A" }));

    const modelA = await screen.findByText("Model A");
    const row = modelA.closest("tr") as HTMLElement;
    expect(within(row).getByText("Missing votes")).toBeInTheDocument();
    expect(within(row).getByText("Discordant votes")).toBeInTheDocument();

    const modelB = screen.getByText("Model B").closest("tr") as HTMLElement;
    expect(within(modelB).queryByText("Missing votes")).not.toBeInTheDocument();
    expect(within(modelB).queryByText("Discordant votes")).not.toBeInTheDocument();
  });
});
