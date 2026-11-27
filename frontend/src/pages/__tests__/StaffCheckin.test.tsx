import React from "react";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));

import StaffCheckin from "../StaffCheckin";

const calls = (path: string, method?: string) =>
  apiMock.mock.calls.filter((c) => c[0] === path && (method === undefined || c[1]?.method === method));

let attendance: { registeredParticipants: number; presentParticipants: number };
let participantPresent: boolean;

function participant() {
  return {
    userId: "u12",
    participantNumber: 12,
    name: "Maria Rossi",
    country: "Italy",
    present: participantPresent,
    models: [{ id: "m1", name: "Dragon", code: "DR-1", categoryName: "Fantasy", displayNumber: 7 }]
  };
}

function defaultApi(path: string, init?: RequestInit) {
  if (path === "/public/events?status=all") return [{ id: "e1", name: "Event One", status: "open" }];
  if (path === "/staff/events/e1/attendance") return attendance;
  if (path === "/staff/events/e1/participants/12") return participant();
  if (path === "/staff/events/e1/participants/12/presence" && init?.method === "POST") {
    participantPresent = JSON.parse(String(init.body)).present;
    attendance = { registeredParticipants: 10, presentParticipants: 4 };
    return {};
  }
  return [];
}

async function pickEvent(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: "Event One" }));
}

describe("StaffCheckin (front desk)", () => {
  beforeEach(() => {
    apiMock.mockReset().mockImplementation(async (path: string, init?: RequestInit) => defaultApi(path, init));
    attendance = { registeredParticipants: 10, presentParticipants: 3 };
    participantPresent = false;
  });

  it("shows the presence counter for the chosen event", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="en" />);
    await pickEvent(user);
    expect(await screen.findByText("Present 3 / 10")).toBeInTheDocument();
    expect(calls("/staff/events/e1/attendance")).toHaveLength(1);
  });

  it("looks the participant up with Enter and shows name, country, models and status", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="en" />);
    await pickEvent(user);
    await user.type(screen.getByLabelText("Participant number"), "12{Enter}");

    expect(await screen.findByText("#12 Maria Rossi")).toBeInTheDocument();
    expect(calls("/staff/events/e1/participants/12")).toHaveLength(1);
    expect(screen.getByText("Italy")).toBeInTheDocument();
    expect(screen.getByText("7 · Dragon")).toBeInTheDocument();
    expect(screen.getByText("Fantasy · DR-1")).toBeInTheDocument();
    expect(screen.getByText("Not present")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark present" })).toBeInTheDocument();
  });

  it("marks the participant present, updates the status and refreshes the counter", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="en" />);
    await pickEvent(user);
    expect(await screen.findByText("Present 3 / 10")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Participant number"), "12{Enter}");
    await user.click(await screen.findByRole("button", { name: "Mark present" }));

    await waitFor(() => expect(calls("/staff/events/e1/participants/12/presence", "POST")).toHaveLength(1));
    expect(calls("/staff/events/e1/participants/12/presence", "POST")[0][1].body).toBe(JSON.stringify({ present: true }));
    expect(await screen.findByRole("button", { name: "Undo presence" })).toBeInTheDocument();
    expect(screen.getByText("Present")).toBeInTheDocument();
    expect(screen.getByText("Present 4 / 10")).toBeInTheDocument();
  });

  it("undoes the presence with the same button", async () => {
    participantPresent = true;
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="en" />);
    await pickEvent(user);
    await user.type(screen.getByLabelText("Participant number"), "12{Enter}");
    await user.click(await screen.findByRole("button", { name: "Undo presence" }));

    await waitFor(() => expect(calls("/staff/events/e1/participants/12/presence", "POST")).toHaveLength(1));
    expect(calls("/staff/events/e1/participants/12/presence", "POST")[0][1].body).toBe(JSON.stringify({ present: false }));
    expect(await screen.findByRole("button", { name: "Mark present" })).toBeInTheDocument();
  });

  it("shows a clear message when no registration has the number (404)", async () => {
    apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/staff/events/e1/participants/99") throw Object.assign(new Error("not found"), { status: 404 });
      return defaultApi(path, init);
    });
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="en" />);
    await pickEvent(user);
    await user.type(screen.getByLabelText("Participant number"), "99{Enter}");
    expect(await screen.findByText("No registration with this number.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark present" })).not.toBeInTheDocument();
  });

  it("does not call the API without an event, and asks for a valid number", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="en" />);
    await user.type(screen.getByLabelText("Participant number"), "5{Enter}");
    expect(await screen.findByText("Select an event to start.")).toBeInTheDocument();
    expect(calls("/staff/events/e1/participants/5")).toHaveLength(0);

    await pickEvent(user);
    await user.clear(screen.getByLabelText("Participant number"));
    await user.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("Enter a valid participant number.")).toBeInTheDocument();
    expect(calls("/staff/events/e1/participants/0")).toHaveLength(0);
  });

  it("shows the server error for other failures and keeps the page usable", async () => {
    apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/staff/events/e1/participants/12") throw Object.assign(new Error("Database unavailable"), { status: 500 });
      return defaultApi(path, init);
    });
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="en" />);
    await pickEvent(user);
    await user.type(screen.getByLabelText("Participant number"), "12{Enter}");
    expect(await screen.findByText("Database unavailable")).toBeInTheDocument();
    expect(screen.queryByText("No registration with this number.")).not.toBeInTheDocument();
  });

  it("uses the Italian texts for the desk", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="it" />);
    expect(screen.getByRole("heading", { name: "Accoglienza" })).toBeInTheDocument();
    await pickEvent(user);
    await user.type(screen.getByLabelText("Numero partecipante"), "12{Enter}");
    const card = (await screen.findByText("#12 Maria Rossi")).closest(".MuiCard-root") as HTMLElement;
    expect(within(card).getByRole("button", { name: "Segna presente" })).toBeInTheDocument();
  });
});
