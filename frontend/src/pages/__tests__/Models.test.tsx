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
      return { model: { ...modelList[0], notes: "my note" }, images: [] };
    if (path === "/admin/models" && !init) return [{ id: "m1", internalNotes: "secret" }];
    if (path === "/admin/models/m1" && init?.method === "PUT") return {};
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

  const adminPuts = () => apiMock.mock.calls.filter((c) => c[0] === "/admin/models/m1" && c[1]?.method === "PUT");

  it("managers read internal notes from /admin/models once and never from /models", async () => {
    roleValue = "manager";
    setup();
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await user.click(await screen.findByText("Space Marine"));
    expect((await screen.findAllByDisplayValue("secret")).length).toBeGreaterThan(0);
    expect(apiMock.mock.calls.filter((c) => c[0] === "/admin/models" && !c[1])).toHaveLength(1);
  });

  it("manager round-trip: edit, save via PUT /admin/models, reopen shows the new value", async () => {
    roleValue = "manager";
    setup();
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await user.click(await screen.findByText("Space Marine"));
    const field = (await screen.findAllByDisplayValue("secret"))[0];
    await user.clear(field);
    await user.type(field, "  updated  ");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(adminPuts()).toHaveLength(1));
    expect(JSON.parse(adminPuts()[0][1].body)).toEqual({ internalNotes: "updated" });
    const mainPut = apiMock.mock.calls.find((c) => c[0] === "/models/m1" && c[1]?.method === "PUT")!;
    expect(JSON.parse(mainPut[1].body)).not.toHaveProperty("internalNotes");
    await user.click(await screen.findByText("Space Marine"));
    expect((await screen.findAllByDisplayValue("updated")).length).toBeGreaterThan(0);
    expect(apiMock.mock.calls.filter((c) => c[0] === "/admin/models" && !c[1])).toHaveLength(1);
  });

  it("does not call PUT /admin/models when internal notes are unchanged", async () => {
    roleValue = "manager";
    setup();
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await user.click(await screen.findByText("Space Marine"));
    await screen.findAllByDisplayValue("secret");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(apiMock.mock.calls.some((c) => c[0] === "/models/m1" && c[1]?.method === "PUT")).toBe(true));
    expect(adminPuts()).toHaveLength(0);
  });

  it("shows a specific toast when the admin PUT fails, after the model was saved", async () => {
    roleValue = "manager";
    setup();
    const base = apiMock.getMockImplementation()!;
    apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/admin/models/m1" && init?.method === "PUT") throw new Error("boom");
      return base(path, init);
    });
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await user.click(await screen.findByText("Space Marine"));
    const field = (await screen.findAllByDisplayValue("secret"))[0];
    await user.type(field, "x");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Model saved, but the internal notes were not saved")).toBeInTheDocument();
    expect(apiMock.mock.calls.some((c) => c[0] === "/models/m1" && c[1]?.method === "PUT")).toBe(true);
  });

  it("never overwrites stored internal notes when they could not be loaded", async () => {
    roleValue = "manager";
    setup();
    const base = apiMock.getMockImplementation()!;
    apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/admin/models" && !init) throw new Error("admin list down");
      return base(path, init);
    });
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await user.click(await screen.findByText("Space Marine"));
    expect(await screen.findByText("admin list down")).toBeInTheDocument();
    const field = screen.getAllByLabelText(/internal notes/i)[0];
    await user.type(field, "typed over a blank baseline");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Model saved, but the internal notes had not loaded and were left unchanged")).toBeInTheDocument();
    expect(adminPuts()).toHaveLength(0);
    expect(apiMock.mock.calls.some((c) => c[0] === "/models/m1" && c[1]?.method === "PUT")).toBe(true);
  });

  it("never renders internal notes for plain users", async () => {
    setup();
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await user.click(await screen.findByText("Space Marine"));
    expect((await screen.findAllByDisplayValue("my note")).length).toBeGreaterThan(0);
    expect(screen.queryByDisplayValue("secret")).not.toBeInTheDocument();
    expect(apiMock.mock.calls.some((c) => String(c[0]).startsWith("/admin/models"))).toBe(false);
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
