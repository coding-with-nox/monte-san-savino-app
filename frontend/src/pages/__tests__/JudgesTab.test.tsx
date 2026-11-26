import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));

import JudgesTab from "../admin/JudgesTab";

const users = [{ id: "u1", email: "judge@example.it", role: "judge" }];
const events = [{ id: "e1", name: "MSS 2026" }];
const categories = [
  { id: "c1", eventId: "e1", name: "Historical" },
  { id: "c2", eventId: "e1", name: "Sci-Fi" },
];
const data = {
  events,
  categories,
  eventName: (id: string) => events.find((e) => e.id === id)?.name ?? id,
  categoryName: (id: string) => categories.find((c) => c.id === id)?.name ?? id,
} as any;

let assignments: any[];

function setup() {
  apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/admin/users") return users;
    if (path === "/admin/judges/assignments" && !init) return assignments.map((a) => ({ ...a }));
    if (path === "/admin/judges/assignments" && init?.method === "POST") {
      const body = JSON.parse(init.body as string);
      assignments.push({ id: `new-${assignments.length}`, ...body });
      return {};
    }
    if (path.startsWith("/admin/judges/assignments/") && init?.method === "PATCH") {
      const id = path.split("/").pop()!;
      const body = JSON.parse(init.body as string);
      assignments = assignments.map((a) => (a.id === id ? { ...a, ...body } : a));
      return {};
    }
    return [];
  });
}

// Form selects, in order: event, judge, class. The form appears with its Assign button once the
// section has loaded; the monitoring select (rendered earlier, outside the loading guard) comes after.
// `hidden: true` because MUI marks the page aria-hidden while a menu is closing.
async function formCombobox(index: number) {
  await screen.findByText("Assign judges");
  return screen.getAllByRole("combobox", { hidden: true })[index];
}

async function pickEvent(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await formCombobox(0));
  await user.click(await screen.findByRole("option", { name: "MSS 2026" }));
}

async function pickJudge(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await formCombobox(1));
  await user.click(await screen.findByRole("option", { name: "judge@example.it" }));
}

const postBodies = () =>
  apiMock.mock.calls
    .filter((c) => c[0] === "/admin/judges/assignments" && c[1]?.method === "POST")
    .map((c) => JSON.parse(c[1].body));

describe("JudgesTab assignments", () => {
  beforeEach(() => {
    apiMock.mockReset();
    assignments = [];
    setup();
  });

  it("assigns one judge to several classes in one go", async () => {
    const user = userEvent.setup();
    renderWithProviders(<JudgesTab language="en" data={data} />);
    await pickEvent(user);
    await pickJudge(user);
    await user.click(await formCombobox(2));
    await user.click(await screen.findByRole("option", { name: "Historical" }));
    await user.click(await screen.findByRole("option", { name: "Sci-Fi" }));
    await user.keyboard("{Escape}");
    expect(screen.getByText("Historical, Sci-Fi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Assign" }));

    await waitFor(() => expect(postBodies()).toHaveLength(2));
    expect(postBodies()).toEqual([
      { eventId: "e1", judgeId: "u1", standingIn: false, categoryId: "c1" },
      { eventId: "e1", judgeId: "u1", standingIn: false, categoryId: "c2" },
    ]);
  });

  it("assigns for all classes when none is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<JudgesTab language="en" data={data} />);
    await pickEvent(user);
    await pickJudge(user);
    await user.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(postBodies()).toHaveLength(1));
    expect(postBodies()).toEqual([{ eventId: "e1", judgeId: "u1", standingIn: false }]);
  });

  it("creates a stand-in assignment when the checkbox is ticked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<JudgesTab language="en" data={data} />);
    await pickEvent(user);
    await pickJudge(user);
    await user.click(screen.getByRole("checkbox", { name: "Stand-in" }));
    await user.click(screen.getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(postBodies()).toHaveLength(1));
    expect(postBodies()[0]).toEqual({ eventId: "e1", judgeId: "u1", standingIn: true });
  });

  it("shows the stand-in flag in the list and toggles it with a PATCH", async () => {
    assignments = [{ id: "a1", eventId: "e1", judgeId: "u1", categoryId: "c1", standingIn: false }];
    const user = userEvent.setup();
    renderWithProviders(<JudgesTab language="en" data={data} />);
    const row = (await screen.findByText("judge@example.it")).closest("li")!;
    expect(within(row).queryByText("Stand-in", { selector: ".MuiChip-label" })).not.toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: "Stand-in judge@example.it" }));

    const patch = apiMock.mock.calls.find((c) => c[1]?.method === "PATCH");
    expect(patch![0]).toBe("/admin/judges/assignments/a1");
    expect(JSON.parse(patch![1].body)).toEqual({ eventId: "e1", judgeId: "u1", categoryId: "c1", standingIn: true });
    expect(await within(row).findByText("Stand-in", { selector: ".MuiChip-label" })).toBeInTheDocument();
  });
});
