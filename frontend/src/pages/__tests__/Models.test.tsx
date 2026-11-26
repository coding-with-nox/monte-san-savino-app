import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
    if (path === "/public/member-roles") return [{ id: "r1", name: "Painter", price: 1500 }];
    if (path.startsWith("/pricing/me")) return { currency: "EUR", totalCents: 0, events: [] };
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

  async function openWizard(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByText("Space Marine");
    await user.click(screen.getAllByRole("button", { name: "Enroll model" })[0]);
  }
  const next = () => screen.getByRole("button", { name: "Next" });
  async function pickClass(user: ReturnType<typeof userEvent.setup>) {
    const [catBox, levelBox] = screen.getAllByRole("combobox");
    await user.click(catBox);
    await user.click(await screen.findByRole("option", { name: "Historical" }));
    await user.click(levelBox);
    await user.click(await screen.findByRole("option", { name: "Beginner" }));
  }
  const postBody = () => JSON.parse(apiMock.mock.calls.find((c) => c[0] === "/models" && c[1]?.method === "POST")![1].body);

  it("does not advance until each step is complete", async () => {
    setup();
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await openWizard(user);
    expect(next()).toBeDisabled();
    await pickClass(user);
    await user.click(next());
    expect(next()).toBeDisabled();
    await user.type(screen.getByLabelText("Model name"), "Dread");
    expect(next()).toBeEnabled();
  });

  it("creates a model with the trimmed name and without internalNotes for plain users", async () => {
    setup();
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await openWizard(user);
    await pickClass(user);
    await user.click(next());
    await user.type(screen.getByLabelText("Model name"), "  Dread  ");
    await user.click(next());
    await user.click(next());
    const submit = screen.getAllByRole("button", { name: "Enroll model" }).at(-1)!;
    await user.click(submit);
    await waitFor(() => expect(apiMock.mock.calls.some((c) => c[0] === "/models" && c[1]?.method === "POST")).toBe(true));
    const body = postBody();
    expect(body).toMatchObject({ name: "Dread", categoryId: "c1", levelId: "l1", isTeam: false });
    expect(body).not.toHaveProperty("teamMembers");
    expect(body).not.toHaveProperty("internalNotes");
  });

  it("adds co-authors inline, previews the fee and sends teamMembers", async () => {
    setup();
    const base = apiMock.getMockImplementation()!;
    apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.includes("settings")) return { baseFeeCents: "2500", modelImages: "false" };
      if (path === "/models" && init?.method === "POST") return { id: "new", code: "173T1" };
      return base(path, init);
    });
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await openWizard(user);
    await pickClass(user);
    await user.click(next());
    await user.type(screen.getByLabelText("Model name"), "Diorama");
    await user.click(next());
    await user.click(screen.getByRole("checkbox", { name: "Team model" }));
    expect(next()).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: /First name/ }), "Ada");
    await user.type(screen.getByRole("textbox", { name: /Last name/ }), "Rossi");
    await user.click(screen.getByRole("combobox", { name: /Team role/ }));
    await user.click(await screen.findByRole("option", { name: /Painter/ }));
    await user.click(next());
    const preview = screen.getByTestId("price-preview");
    expect(preview).toHaveTextContent("€25.00");
    expect(preview).toHaveTextContent("€15.00");
    await user.click(screen.getAllByRole("button", { name: "Enroll model" }).at(-1)!);
    expect(await screen.findByText("Model enrolled. Code 173T1.")).toBeInTheDocument();
    expect(postBody()).toMatchObject({ isTeam: true, teamMembers: [{ name: "Ada", surname: "Rossi", roleId: "r1" }] });
    expect(postBody().teamMembers[0]).not.toHaveProperty("email");
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

  describe("error handling", () => {
    let unhandled: unknown[];
    const onUnhandled = (e: unknown) => { unhandled.push(e); };
    beforeEach(() => {
      unhandled = [];
      process.on("unhandledRejection", onUnhandled);
    });
    afterEach(() => {
      process.off("unhandledRejection", onUnhandled);
    });

    it("shows a toast and keeps the list when deleting a model fails", async () => {
      setup();
      const base = apiMock.getMockImplementation()!;
      apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
        if (path === "/models/m1" && init?.method === "DELETE") throw new Error("Delete refused");
        return base(path, init);
      });
      const user = userEvent.setup();
      renderWithProviders(<Models language="en" />);
      await screen.findByText("Space Marine");
      const row = screen.getByText("Space Marine").closest("tr")!;
      const buttons = row.querySelectorAll("button");
      await user.click(buttons[buttons.length - 1]);
      await user.click(await screen.findByRole("button", { name: "Confirm" }));
      expect(await screen.findByText("Delete refused")).toBeInTheDocument();
      expect(screen.getByText("Space Marine")).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 20));
      expect(unhandled).toEqual([]);
    });

    it("shows a toast and keeps the image when deleting an image fails", async () => {
      setup();
      const base = apiMock.getMockImplementation()!;
      apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
        if (path.includes("settings")) return { modelImages: "true", maxModelsPerUser: "" };
        if (path === "/models/m1" && !init)
          return { model: { ...modelList[0], notes: "my note" }, images: [{ id: "i1", url: "http://x/y.jpg" }] };
        if (path === "/models/m1/images/i1" && init?.method === "DELETE") throw new Error("Image delete refused");
        return base(path, init);
      });
      const user = userEvent.setup();
      renderWithProviders(<Models language="en" />);
      await user.click(await screen.findByText("Space Marine"));
      await screen.findByText("http://x/y.jpg").catch(() => null);
      const icons = await screen.findAllByTestId("DeleteIcon");
      // last DeleteIcon belongs to the image row (rendered after the model row)
      const imgDelete = icons[icons.length - 1].closest("button")!;
      await user.click(imgDelete);
      await user.click(await screen.findByRole("button", { name: "Confirm" }));
      expect(await screen.findByText("Image delete refused")).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 20));
      expect(unhandled).toEqual([]);
    });

    it("shows a toast and does not expand the row when opening a model fails", async () => {
      setup();
      const base = apiMock.getMockImplementation()!;
      apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
        if (path === "/models/m1" && !init) throw new Error("Detail unavailable");
        return base(path, init);
      });
      const user = userEvent.setup();
      renderWithProviders(<Models language="en" />);
      await user.click(await screen.findByText("Space Marine"));
      expect(await screen.findByText("Detail unavailable")).toBeInTheDocument();
      expect(screen.queryByDisplayValue("my note")).not.toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 20));
      expect(unhandled).toEqual([]);
    });
  });
});
