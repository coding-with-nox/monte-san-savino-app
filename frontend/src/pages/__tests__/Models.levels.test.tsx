import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
let levelUpWarn = false;
/** Error thrown by POST /models in the test that sets it. */
let postError: unknown = null;

vi.mock("../../lib/api", () => ({
  ApiError: class extends Error {},
  errorCode: (e: any) => e?.code,
  api: (...a: unknown[]) => apiMock(...a)
}));
vi.mock("../../lib/auth", () => ({
  getRole: () => "user",
  roleAtLeast: () => false
}));
// PrintActions performs its own api calls; not under test here
vi.mock("../../components/PrintActions", () => ({ default: () => null }));

import Models from "../Models";

const modelList = [{ id: "m1", name: "Space Marine", code: "A1", categoryId: "c1", levelId: "l1", isTeam: false }];

/** Error shaped like the api() ones: status, backend code and the JSON body. */
function apiError(status: number, code: string, details: Record<string, unknown> = {}) {
  return Object.assign(new Error(code), { status, code, details });
}

function setup() {
  apiMock.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/models" && init?.method === "POST" && postError) throw postError;
    if (path === "/models" && !init) return modelList;
    if (path === "/models" && init?.method === "POST") return { id: "new" };
    if (path === "/public/categories") return [{ id: "c1", eventId: "e1", name: "Historical", status: "open" }];
    if (path === "/public/levels") return [{ id: "l1", name: "Beginner" }, { id: "l2", name: "Standard" }];
    if (path === "/public/member-roles") return [];
    if (path.startsWith("/pricing/me")) return { currency: "EUR", totalCents: 0, events: [] };
    if (path.startsWith("/users/me/level-up")) return { warn: levelUpWarn };
    if (path.includes("settings")) return { modelImages: "false" };
    return [];
  });
}

const next = () => screen.getByRole("button", { name: "Next" });
const submit = () => screen.getAllByRole("button", { name: "Enroll model" }).at(-1)!;

async function openWizard(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByText("Space Marine");
  await user.click(screen.getAllByRole("button", { name: "Enroll model" })[0]);
}

async function pickClass(user: ReturnType<typeof userEvent.setup>, levelName: string) {
  const [catBox, levelBox] = screen.getAllByRole("combobox");
  await user.click(catBox);
  await user.click(await screen.findByRole("option", { name: "Historical" }));
  await user.click(levelBox);
  await user.click(await screen.findByRole("option", { name: levelName }));
}

async function fillUntilSubmit(user: ReturnType<typeof userEvent.setup>, levelName: string) {
  await pickClass(user, levelName);
  await user.click(next());
  await user.type(screen.getByLabelText("Model name"), "Dread");
  await user.click(next());
  await user.click(next());
  await user.click(submit());
}

describe("Models wizard: levels and registrations", () => {
  beforeEach(() => {
    apiMock.mockReset();
    levelUpWarn = false;
    postError = null;
    setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("warns when a Standard level is picked by someone who must move up to Masters", async () => {
    levelUpWarn = true;
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await openWizard(user);
    await pickClass(user, "Standard");
    expect(await screen.findByTestId("level-up-warning")).toHaveTextContent(
      "You won a Gold in the Standard category in a previous edition: you must enter Masters"
    );
    expect(apiMock).toHaveBeenCalledWith("/users/me/level-up?eventId=e1");
  });

  it("does not ask about the move-up for other levels", async () => {
    levelUpWarn = true;
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await openWizard(user);
    await pickClass(user, "Beginner");
    await waitFor(() => expect(screen.getAllByRole("combobox")[1]).toHaveTextContent("Beginner"));
    expect(screen.queryByTestId("level-up-warning")).not.toBeInTheDocument();
    expect(apiMock.mock.calls.some((c) => String(c[0]).startsWith("/users/me/level-up"))).toBe(false);
  });

  it("hides the warning when the server says no move-up is due", async () => {
    levelUpWarn = false;
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await openWizard(user);
    await pickClass(user, "Standard");
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/users/me/level-up?eventId=e1"));
    expect(screen.queryByTestId("level-up-warning")).not.toBeInTheDocument();
  });

  it("on LEVEL_LOCKED preselects the locked level and explains why", async () => {
    postError = apiError(422, "LEVEL_LOCKED", { lockedLevelId: "l2", lockedLevelName: "Standard" });
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await openWizard(user);
    await fillUntilSubmit(user, "Beginner");

    expect(await screen.findByTestId("level-locked")).toHaveTextContent(
      "You have already chosen the level Standard for this event: all your models must have the same level"
    );
    expect(screen.getAllByRole("combobox")[1]).toHaveTextContent("Standard");
  });

  it("shows the registration-closed message when POST /models is refused", async () => {
    postError = apiError(403, "REGISTRATION_CLOSED");
    const user = userEvent.setup();
    renderWithProviders(<Models language="en" />);
    await openWizard(user);
    await fillUntilSubmit(user, "Beginner");
    expect(await screen.findByText("Registrations are closed")).toBeInTheDocument();
  });
});
