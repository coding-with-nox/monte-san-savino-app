import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import { AccessContext } from "../../lib/access";
import { setSession } from "../../lib/auth";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));
vi.mock("../../components/PrintActions", () => ({ default: () => null }));

import Models from "../Models";

const me = { id: "u1", email: "me@x.it", firstName: "Io", lastName: "Stesso", participantNumber: 7 };
const ada = { id: "u2", email: "ada@x.it", firstName: "Ada", lastName: "Rossi", participantNumber: 173 };

function setup(role = "staff", permissions: string[] = ["enrollOnBehalf"]) {
  localStorage.clear();
  setSession(`h.${btoa(JSON.stringify({ role, sub: me.id, email: me.email }))}.s`, "refresh", 3600);
  apiMock.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
    if (path.startsWith("/admin/users/enrollable")) return path.endsWith("q=") ? [ada, me] : [me];
    if (path === "/models" && init?.method === "POST") return { id: "new", code: "173" };
    // a model in the list: no empty-state button with the same name as the submit button
    if (path === "/models") return [{ id: "m1", name: "Knight", categoryId: "c1", levelId: "l1", isTeam: false }];
    if (path === "/public/categories") return [{ id: "c1", eventId: "e1", name: "Historical", status: "open" }];
    if (path === "/public/levels") return [{ id: "l1", name: "Beginner" }];
    if (path.startsWith("/pricing/me")) return { currency: "EUR", totalCents: 9900, events: [] };
    if (path === "/settings") return { baseFeeCents: "2500" };
    return [];
  });
  renderWithProviders(
    <AccessContext.Provider value={{ sections: null, permissions }}>
      <Models language="en" />
    </AccessContext.Provider>
  );
}

const next = () => screen.getByRole("button", { name: "Next" });
const postBody = () => JSON.parse(apiMock.mock.calls.find((c) => c[0] === "/models" && c[1]?.method === "POST")![1].body);

async function openWizard(user: ReturnType<typeof userEvent.setup>) {
  await user.click((await screen.findAllByRole("button", { name: "Enroll model" }))[0]);
}

async function pickClass(user: ReturnType<typeof userEvent.setup>) {
  const boxes = screen.getAllByRole("combobox").filter((el) => el.tagName !== "INPUT");
  await user.click(boxes[0]);
  await user.click(await screen.findByRole("option", { name: "Historical" }));
  await user.click(boxes[1]);
  await user.click(await screen.findByRole("option", { name: "Beginner" }));
}

async function finish(user: ReturnType<typeof userEvent.setup>) {
  await pickClass(user);
  await user.click(next());
  await user.type(screen.getByLabelText("Model name"), "Dread");
  await user.click(next());
  await user.click(next());
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getAllByRole("button", { name: "Enroll model" }).at(-1)!);

describe("Models: enroll on behalf of another user", () => {
  beforeEach(() => { apiMock.mockReset(); });

  it("hides the field without the permission", async () => {
    setup("staff", []);
    const user = userEvent.setup();
    await openWizard(user);
    expect(screen.queryByLabelText("Enroll on behalf of")).not.toBeInTheDocument();
  });

  it("defaults to myself with my participant number and sends no userId", async () => {
    setup();
    const user = userEvent.setup();
    await openWizard(user);
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Enroll on behalf of" })).toHaveValue("Myself — no. 7"));
    await finish(user);
    expect(screen.getByText("Model owner")).toBeInTheDocument();
    await submit(user);
    await waitFor(() => expect(apiMock.mock.calls.some((c) => c[0] === "/models" && c[1]?.method === "POST")).toBe(true));
    expect(postBody()).not.toHaveProperty("userId");
  });

  it("searches a participant, shows the owner in the summary and sends userId", async () => {
    setup("admin", []);
    const user = userEvent.setup();
    await openWizard(user);
    const field = screen.getByRole("combobox", { name: "Enroll on behalf of" });
    await user.click(field);
    await user.click(await screen.findByRole("option", { name: "Ada Rossi — no. 173" }));
    expect(field).toHaveValue("Ada Rossi — no. 173");
    await finish(user);
    expect(screen.getByText("The model and its fee will belong to Ada Rossi — no. 173: it will appear in their list, not yours.")).toBeInTheDocument();
    // my own running total must not be shown for somebody else
    expect(screen.getByTestId("price-preview")).not.toHaveTextContent("€99.00");
    await submit(user);
    expect(await screen.findByText("Model enrolled for Ada Rossi. Code 173.")).toBeInTheDocument();
    expect(postBody()).toMatchObject({ userId: "u2", name: "Dread" });
  });
});
