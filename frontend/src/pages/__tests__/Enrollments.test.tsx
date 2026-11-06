import React from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
const downloadMock = vi.fn();
let roleValue: string | null = "user";

vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));
vi.mock("../../lib/download", () => ({ downloadAuthenticatedFile: (...a: unknown[]) => downloadMock(...a) }));
vi.mock("../../lib/auth", () => ({
  getRole: () => roleValue,
  roleAtLeast: (actual: string, min: string) => {
    const order = ["user", "staff", "judge", "manager", "admin"];
    return order.indexOf(actual) >= order.indexOf(min);
  }
}));

import Enrollments from "../Enrollments";

const events = [{ id: "e1", name: "MSS 2026", status: "open" }];
const categories = [
  { id: "c1", eventId: "e1", name: "Historical", status: "open" },
  { id: "c2", eventId: "e1", name: "Closed cat", status: "closed" }
];
const models = [{ id: "m1", name: "Space Marine", categoryId: "c1", code: "A1" }];

function setup(enrollments: unknown[] = []) {
  apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/enrollments") return enrollments;
    if (path === "/public/events" || path === "/public/events?status=all") return events;
    if (path === "/models") return models;
    if (path === "/public/categories") return categories;
    if (path === "/admin/users") return [{ id: "u1", email: "mario@example.com" }];
    if (path.startsWith("/admin/enrollments"))
      return [{ id: "a1", userId: "u1", eventId: "e1", modelId: "m1", categoryId: "c1", checkedIn: true, absent: false }];
    if (path === "/events/e1/enroll" && init?.method === "POST") return {};
    return [];
  });
}

describe("Enrollments", () => {
  beforeEach(() => {
    apiMock.mockReset();
    downloadMock.mockReset();
    roleValue = "user";
  });

  it("shows empty state when there are no enrollments", async () => {
    setup([]);
    renderWithProviders(<Enrollments language="en" />);
    expect(await screen.findByText("No active enrollments")).toBeInTheDocument();
  });

  it("resolves event, model and category names and splits active from past", async () => {
    setup([
      { id: "x1", eventId: "e1", modelId: "m1", categoryId: "c1", checkedIn: true },
      { id: "x2", eventId: "old-event-id", checkedIn: false }
    ]);
    renderWithProviders(<Enrollments language="en" />);
    expect(await screen.findByText("Space Marine (A1)")).toBeInTheDocument();
    expect(screen.getByText("Historical")).toBeInTheDocument();
    expect(screen.getByText("✓ checked-in")).toBeInTheDocument();
    // enrollment on a non-active event goes in the past table, id truncated to 8 chars
    expect(screen.getByText("old-even")).toBeInTheDocument();
    expect(screen.getByText("Past events")).toBeInTheDocument();
  });

  it("does not expose admin management or call admin endpoints for plain users", async () => {
    setup([]);
    renderWithProviders(<Enrollments language="en" />);
    await screen.findByText("No active enrollments");
    expect(screen.queryByText("Gestione iscrizioni evento")).not.toBeInTheDocument();
    expect(apiMock.mock.calls.some((c) => String(c[0]).startsWith("/admin"))).toBe(false);
  });

  it("shows the participant table for managers", async () => {
    roleValue = "manager";
    setup([]);
    renderWithProviders(<Enrollments language="en" />);
    expect(await screen.findByText("Gestione iscrizioni evento")).toBeInTheDocument();
    expect(await screen.findByText("mario@example.com")).toBeInTheDocument();
  });

  it("enrolls in an event and confirms", async () => {
    setup([]);
    const user = userEvent.setup();
    renderWithProviders(<Enrollments language="en" />);
    await screen.findByText("No active enrollments");
    await user.click(screen.getAllByRole("button", { name: "Enroll" })[0]);
    // submit stays disabled until an event is selected
    const submit = screen.getAllByRole("button", { name: "Enroll" }).find((b) => (b as HTMLButtonElement).type === "button" && (b as HTMLButtonElement).disabled);
    expect(submit).toBeDefined();
    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByRole("option", { name: "MSS 2026" }));
    const enabled = screen.getAllByRole("button", { name: "Enroll" }).filter((b) => !(b as HTMLButtonElement).disabled);
    await user.click(enabled[enabled.length - 1]);
    expect(await screen.findByText("Enrollment submitted.")).toBeInTheDocument();
    const call = apiMock.mock.calls.find((c) => c[0] === "/events/e1/enroll")!;
    expect(call[1].method).toBe("POST");
    expect(JSON.parse(call[1].body)).toEqual({});
  });

  it("shows the server error when enrolling fails", async () => {
    setup([]);
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/public/events" || path === "/public/events?status=all") return events;
      if (path === "/events/e1/enroll") throw new Error("Already enrolled");
      return [];
    });
    const user = userEvent.setup();
    renderWithProviders(<Enrollments language="en" />);
    await user.click(screen.getAllByRole("button", { name: "Enroll" })[0]);
    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(await screen.findByRole("option", { name: "MSS 2026" }));
    const enabled = screen.getAllByRole("button", { name: "Enroll" }).filter((b) => !(b as HTMLButtonElement).disabled);
    await user.click(enabled[enabled.length - 1]);
    expect(await screen.findByText("Already enrolled")).toBeInTheDocument();
  });

  it("exports own enrollments", async () => {
    setup([]);
    const user = userEvent.setup();
    renderWithProviders(<Enrollments language="en" />);
    await user.click(screen.getByRole("button", { name: /export mie iscrizioni/i }));
    expect(downloadMock).toHaveBeenCalledWith("/exports/my-enrollments", "my-enrollments.xlsx");
  });

  it("manager event export requires an event to be selected", async () => {
    roleValue = "manager";
    setup([]);
    renderWithProviders(<Enrollments language="en" />);
    await screen.findByText("mario@example.com");
    const btn = screen.getByRole("button", { name: /export iscrizioni evento/i });
    expect(btn).toBeDisabled();
    expect(within(document.body).queryByText("Export failed")).not.toBeInTheDocument();
  });
});
