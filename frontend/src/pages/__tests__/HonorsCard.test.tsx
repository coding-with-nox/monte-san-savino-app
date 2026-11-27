import React from "react";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ api: (...a: unknown[]) => apiMock(...a) }));

import HonorsCard from "../admin/HonorsCard";

const events = [{ id: "e1", name: "MSS 2026", status: "open" }];
const categories = [{ id: "c1", eventId: "e1", name: "Armor", status: "open" }];
const models = [
  { id: "m1", name: "Tank One", categoryId: "c1", code: "T1", displayNumber: 3 },
  { id: "m2", name: "Tank Two", categoryId: "c1", code: "T2", displayNumber: 3 },
  { id: "m3", name: "Lonely", categoryId: "c1", code: "L1", displayNumber: 7 }
];
const unassigned = { id: "h1", eventId: "e1", code: "bos", name: "Best of Show", sortOrder: 1, assignment: null };
const assigned = {
  id: "h2",
  eventId: "e1",
  code: "t1",
  name: "Trophy One",
  sortOrder: 2,
  assignment: {
    categoryId: "c1",
    categoryName: "Armor",
    displayNumber: 3,
    modelId: null,
    modelName: null,
    modelCode: null,
    wholeDisplay: true,
    exhibitor: null
  }
};

/** Honors list served on GET; `assignError` makes every assignment request fail. */
function mockApi(honors: unknown[], assignError?: Error) {
  apiMock.mockReset().mockImplementation(async (path: string) => {
    if (path.startsWith("/admin/honors?eventId=")) return honors;
    if (assignError && path.endsWith("/assign")) throw assignError;
    return {};
  });
}

/** Body of the first request with this method and path. */
function bodyOf(method: string, path: string) {
  const call = apiMock.mock.calls.find(([p, init]) => p === path && (init as RequestInit | undefined)?.method === method);
  expect(call, `${method} ${path} was not called`).toBeDefined();
  const init = call![1] as RequestInit;
  return init.body ? JSON.parse(init.body as string) : undefined;
}

function renderCard() {
  return renderWithProviders(<HonorsCard language="en" events={events} categories={categories} models={models} />);
}

/** Renders the card, opens the assign dialog of the first honor, picks class Armor and the given display. */
async function pickDisplay(displayNumber: number) {
  const user = userEvent.setup();
  renderCard();
  await user.click(await screen.findByRole("button", { name: "Assign" }));
  const dialog = await screen.findByRole("dialog", { name: /Assign special award/ });
  fireEvent.mouseDown(within(dialog).getByLabelText("Class"));
  fireEvent.click(await screen.findByRole("option", { name: "Armor" }));
  fireEvent.mouseDown(within(dialog).getByLabelText("Display"));
  fireEvent.click(await screen.findByRole("option", { name: String(displayNumber) }));
  return { user, dialog };
}

describe("HonorsCard", () => {
  beforeEach(() => {
    mockApi([]);
  });

  it("loads the MSS awards after confirmation", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(await screen.findByRole("button", { name: "Load MSS awards" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(bodyOf("POST", "/admin/honors/preset")).toEqual({ eventId: "e1" }));
  });

  it("assigns an honor to a whole display", async () => {
    mockApi([unassigned]);
    const { dialog } = await pickDisplay(3);
    expect(within(dialog).getByRole("radio", { name: "Whole display" })).toBeChecked();
    await userEvent.setup().click(within(dialog).getByRole("button", { name: "Assign" }));
    await waitFor(() =>
      expect(bodyOf("POST", "/admin/honors/h1/assign")).toEqual({ categoryId: "c1", displayNumber: 3 })
    );
  });

  it("assigns an honor to one model of the display", async () => {
    mockApi([unassigned]);
    const { user, dialog } = await pickDisplay(3);
    await user.click(within(dialog).getByRole("radio", { name: "Tank Two (T2)" }));
    await user.click(within(dialog).getByRole("button", { name: "Assign" }));
    await waitFor(() =>
      expect(bodyOf("POST", "/admin/honors/h1/assign")).toEqual({ categoryId: "c1", displayNumber: 3, modelId: "m2" })
    );
  });

  it("explains a 409 conflict inside the dialog and keeps it open", async () => {
    mockApi([unassigned], Object.assign(new Error("ALREADY_ASSIGNED"), { status: 409 }));
    const { user, dialog } = await pickDisplay(3);
    await user.click(within(dialog).getByRole("button", { name: "Assign" }));
    expect(await within(dialog).findByText("Award already assigned: remove the existing assignment first.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /Assign special award/ })).toBeInTheDocument();
  });

  it("removes an assignment after confirmation", async () => {
    mockApi([assigned]);
    const user = userEvent.setup();
    renderCard();
    expect(await screen.findByText("Armor · Display 3 · Whole display")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Remove assignment" }));
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(apiMock.mock.calls.some(([p, init]) => p === "/admin/honors/h2/assignment" && (init as RequestInit).method === "DELETE")).toBe(true));
  });
});
