import React from "react";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));

import AwardReviewCard from "../AwardReviewCard";

const EVENTS = [{ id: "e1", name: "Event One" }];
const BRACKETS = [
  { medalLabel: "None", medalRank: 0, lowLimit: 0, highLimit: 0 },
  { medalLabel: "Silver", medalRank: 3, lowLimit: 8, highLimit: 10 },
  { medalLabel: "Gold", medalRank: 4, lowLimit: 11, highLimit: 12 }
];
const ROWS = [
  {
    modelId: "m1", name: "Model A", displayNumber: 7, code: "C-007", totalScore: 12,
    award: { id: "a1", medalLabel: "Gold", medalRank: 4 }, source: "aggregate",
    issues: ["PARTIAL_VOTES", "DISCORDANT_VOTES"],
    votes: [{ judgeName: "Ada", rank: 1 }, { judgeName: "Bob", rank: 3 }]
  },
  {
    modelId: "m2", name: "Model B", displayNumber: 8, totalScore: 9,
    award: { id: "a2", medalLabel: "Silver", medalRank: 3 }, source: "override", overrideNote: "Recount agreed",
    votes: [{ judgeName: "Ada", rank: 2 }]
  }
];

function setup(overrides: { brackets?: boolean; patchError?: unknown } = {}) {
  apiMock.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === "PATCH") {
      if (overrides.patchError) throw overrides.patchError;
      return {};
    }
    if (path === "/public/categories")
      return [
        { id: "c1", eventId: "e1", name: "Cat A", status: "closed" },
        { id: "c2", eventId: "e1", name: "Cat B", status: "open" }
      ];
    if (path === "/awards/categories/c1/review")
      return { categoryId: "c1", categoryName: "Cat A", eventId: "e1", brackets: overrides.brackets ? [] : BRACKETS, rows: ROWS };
    return [];
  });
}

/** Picks event "Event One", then closed class "Cat A". */
async function chooseClass(user: ReturnType<typeof userEvent.setup>) {
  const [eventSelect] = screen.getAllByRole("combobox");
  await user.click(eventSelect);
  await user.click(await screen.findByRole("option", { name: "Event One" }));
  await user.click(screen.getAllByRole("combobox")[1]);
  await user.click(await screen.findByRole("option", { name: "Cat A" }));
  await screen.findByText("Model A");
}

describe("AwardReviewCard", () => {
  beforeEach(() => setup());

  it("counts the rows still to review and highlights only those with issues", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AwardReviewCard language="en" events={EVENTS} />);
    await chooseClass(user);

    expect(screen.getByText("1 to review")).toBeInTheDocument();
    const rowA = screen.getByText("Model A").closest("tr") as HTMLElement;
    const rowB = screen.getByText("Model B").closest("tr") as HTMLElement;
    expect(rowA).toHaveAttribute("data-flagged", "true");
    expect(rowB).not.toHaveAttribute("data-flagged");
    expect(within(rowA).getByText("Missing votes")).toBeInTheDocument();
    expect(within(rowA).getByText("Discordant votes")).toBeInTheDocument();
    expect(within(rowB).queryByText("Missing votes")).not.toBeInTheDocument();
  });

  it("shows the override chip with its note in a tooltip", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AwardReviewCard language="en" events={EVENTS} />);
    await chooseClass(user);

    const rowB = screen.getByText("Model B").closest("tr") as HTMLElement;
    expect(within(rowB).getByText("Corrected")).toBeInTheDocument();
    await user.hover(within(rowB).getByText("Corrected"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Recount agreed");
  });

  it("expands a row to show each judge's vote", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AwardReviewCard language="en" events={EVENTS} />);
    await chooseClass(user);

    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Votes Model A" }));
    expect(screen.getByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("sends the chosen bracket and note in the correction body", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AwardReviewCard language="en" events={EVENTS} />);
    await chooseClass(user);

    await user.click(within(screen.getByText("Model A").closest("tr") as HTMLElement).getByRole("button", { name: "Correct medal" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("The chosen medal replaces the jury's result for this model: the computed award no longer applies.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Silver" }));
    await user.type(within(dialog).getByRole("textbox"), " Recount ");
    await user.click(within(dialog).getByRole("button", { name: "Confirm correction" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/awards/a1", {
      method: "PATCH",
      body: JSON.stringify({ medalLabel: "Silver", medalRank: 3, note: "Recount" })
    }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Medal corrected.")).toBeInTheDocument();
  });

  it("omits the note when it is left empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<AwardReviewCard language="en" events={EVENTS} />);
    await chooseClass(user);

    await user.click(within(screen.getByText("Model B").closest("tr") as HTMLElement).getByRole("button", { name: "Correct medal" }));
    const dialog = await screen.findByRole("dialog");
    // Model B already holds Silver: the dialog preselects it.
    expect(within(dialog).getByRole("combobox")).toHaveTextContent("Silver");
    await user.click(within(dialog).getByRole("button", { name: "Confirm correction" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/awards/a2", {
      method: "PATCH",
      body: JSON.stringify({ medalLabel: "Silver", medalRank: 3 })
    }));
  });

  it("explains a 422 as an invalid medal and keeps the dialog open", async () => {
    setup({ patchError: Object.assign(new Error("medal not in brackets"), { status: 422 }) });
    const user = userEvent.setup();
    renderWithProviders(<AwardReviewCard language="en" events={EVENTS} />);
    await chooseClass(user);

    await user.click(within(screen.getByText("Model A").closest("tr") as HTMLElement).getByRole("button", { name: "Correct medal" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Confirm correction" }));

    expect(await screen.findByText("Invalid medal for this event.")).toBeInTheDocument();
    expect(screen.queryByText("medal not in brackets")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("explains a 409 as a class that is not closed", async () => {
    setup({ patchError: Object.assign(new Error("CATEGORY_NOT_CLOSED"), { status: 409 }) });
    const user = userEvent.setup();
    renderWithProviders(<AwardReviewCard language="en" events={EVENTS} />);
    await chooseClass(user);

    await user.click(within(screen.getByText("Model A").closest("tr") as HTMLElement).getByRole("button", { name: "Correct medal" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirm correction" }));
    expect(await screen.findByText("The class is not closed yet: correction is not allowed.")).toBeInTheDocument();
  });

  it("warns when the event has no award ranges (brackets come with the review)", async () => {
    setup({ brackets: true });
    const user = userEvent.setup();
    renderWithProviders(<AwardReviewCard language="en" events={EVENTS} />);
    await chooseClass(user);

    expect(await screen.findByText("This event has no award ranges: set them in Admin → Judging to correct medals.")).toBeInTheDocument();
    expect(apiMock.mock.calls.some(([path]) => String(path).startsWith("/admin/award-brackets"))).toBe(false);
  });
});
