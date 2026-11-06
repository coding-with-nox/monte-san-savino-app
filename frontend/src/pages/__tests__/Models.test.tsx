import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
let roleValue: string | null = "user";
let maxModels: number | null = null;

vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));
vi.mock("../../lib/auth", () => ({
  getRole: () => roleValue,
  roleAtLeast: (actual: string, min: string) => {
    const order = ["user", "staff", "judge", "manager", "admin"];
    return order.indexOf(actual) >= order.indexOf(min);
  }
}));
// PrintActions performs its own api calls; not under test here
vi.mock("../../components/PrintActions", () => ({ default: () => null }));

import Models from "../Models";

const modelList = [
  { id: "m1", name: "Space Marine", code: "A1", categoryId: "c1", levelId: "l1", isTeam: false }
];

function setup(list: unknown[] = modelList) {
  apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/models" && !init) return list;
    if (path === "/models" && init?.method === "POST") return { id: "new" };
    if (path === "/models/m1" && !init)
      return { model: { ...modelList[0], notes: "my note", internalNotes: "secret" }, images: [] };
    if (path === "/models/m1" && init?.method === "PUT") return {};
    if (path === "/public/categories") return [{ id: "c1", eventId: "e1", name: "Historical", status: "open" }];
    if (path === "/public/levels") return [{ id: "l1", name: "Beginner" }];
    if (path === "/teams") return [];
    if (path.includes("settings")) return { maxModelsPerUser: maxModels === null ? "" : String(maxModels), modelImages: "false" };
    return [];
  });
}

describe("Models", () => {
  beforeEach(() => {
    apiMock.mockReset();
    roleValue = "user";
    maxModels = null;
  });

  it("shows the empty state without models", async () => {
    setup([]);
    renderWithProviders(<Models language="en" />);
    expect(await screen.findByText("No models")).toBeInTheDocument();
  });

  it("lists models with resolved category name", async () => {
    setup();
    renderWithProviders(<Models language="en" />);
    expect(await screen.findByText("Space Marine")).toBeInTheDocument();
    expect(screen.getByText("Historical")).toBeInTheDocument();
  });

  it("shows a toast when loading models fails", async () => {
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/models") throw new Error("Server down");
      return [];
    });
    renderWithProviders(<Models language="en" />);
    expect(await screen.findByText("Server down")).toBeInTheDocument();
  });

  it("keeps the create form submit disabled until name, category and level are set", async () => {
    setup();
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await screen.findByText("Space Marine");
    const openers = screen.getAllByRole("button", { name: "Enroll model" });
    await user.click(openers[0]);
    const submit = () => screen.getAllByRole("button", { name: "Enroll model" }).find((b) => (b as HTMLButtonElement).type === "button" && b.getAttribute("class")?.includes("fullWidth"))!;
    expect(submit()).toBeDisabled();
    await user.type(screen.getByLabelText("Model name"), "Dread");
    expect(submit()).toBeDisabled();
  });

  it("creates a model with the trimmed name and without internalNotes for plain users", async () => {
    setup();
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await screen.findByText("Space Marine");
    await user.click(screen.getAllByRole("button", { name: "Enroll model" })[0]);
    await user.type(screen.getByLabelText("Model name"), "  Dread  ");
    const [catBox, levelBox] = screen.getAllByRole("combobox");
    await user.click(catBox);
    await user.click(await screen.findByRole("option", { name: "Historical" }));
    await user.click(levelBox);
    await user.click(await screen.findByRole("option", { name: "Beginner" }));
    const submit = screen.getAllByRole("button", { name: "Enroll model" }).find((b) => !(b as HTMLButtonElement).disabled && b.getAttribute("class")?.includes("fullWidth"))!;
    await user.click(submit);
    await waitFor(() => expect(apiMock.mock.calls.some((c) => c[0] === "/models" && c[1]?.method === "POST")).toBe(true));
    const post = apiMock.mock.calls.find((c) => c[0] === "/models" && c[1]?.method === "POST")!;
    const body = JSON.parse(post[1].body);
    expect(body).toMatchObject({ name: "Dread", categoryId: "c1", levelId: "l1", isTeam: false, teamId: null });
    expect(body).not.toHaveProperty("internalNotes");
  });

  it("only managers see and send internal notes", async () => {
    roleValue = "manager";
    setup();
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await user.click(await screen.findByText("Space Marine"));
    expect((await screen.findAllByDisplayValue("secret")).length).toBeGreaterThan(0);
  });

  it("never renders internal notes for plain users", async () => {
    setup();
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await user.click(await screen.findByText("Space Marine"));
    expect((await screen.findAllByDisplayValue("my note")).length).toBeGreaterThan(0);
    expect(screen.queryByDisplayValue("secret")).not.toBeInTheDocument();
  });

  it("disables creation when the per-user model limit is reached", async () => {
    maxModels = 1;
    setup();
    renderWithProviders(<Models language="en" />);
    await screen.findByText("Space Marine");
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Enroll model" })[0]).toBeDisabled());
  });
});
