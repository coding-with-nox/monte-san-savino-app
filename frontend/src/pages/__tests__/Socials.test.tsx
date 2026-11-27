import React from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();

vi.mock("../../lib/api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  errorCode: (e: any) => e?.code,
  api: (...a: unknown[]) => apiMock(...a)
}));

import Socials from "../Socials";
import { ApiError } from "../../lib/api";

const EVENTS = [{ id: "e1", name: "Evento Uno", status: "open" }];

// Routes the public socials endpoints; each display number answers with its own state.
function mockPublicApi(displays: Record<string, () => unknown>, available = true) {
  apiMock.mockImplementation(async (path: string) => {
    if (path === "/public/events") return EVENTS;
    if (path === "/public/socials/e1") return { available };
    const match = /^\/public\/socials\/e1\/displays\/(.+)$/.exec(path);
    if (match && displays[match[1]]) return displays[match[1]]();
    throw new ApiError(404, "not found");
  });
}

async function chooseEventAndSearch(user: ReturnType<typeof userEvent.setup>, number: string) {
  await user.click(await screen.findByRole("combobox", { name: "Event" }));
  await user.click(await screen.findByRole("option", { name: "Evento Uno" }));
  await user.type(await screen.findByLabelText("Display number"), number);
  await user.click(screen.getByRole("button", { name: "Search" }));
}

describe("Socials page", () => {
  beforeEach(() => {
    apiMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("explains that the data is not yet visible when the event is not available", async () => {
    mockPublicApi({}, false);
    const user = userEvent.setup();
    renderWithProviders(<Socials language="en" />);

    await user.click(await screen.findByRole("combobox", { name: "Event" }));
    await user.click(await screen.findByRole("option", { name: "Evento Uno" }));

    expect(await screen.findByText("The data will be visible at the end of judging")).toBeInTheDocument();
    expect(screen.queryByLabelText("Display number")).not.toBeInTheDocument();
  });

  it("shows class, models, exhibitor and social links of an opted-in display", async () => {
    mockPublicApi({
      "12": () => ({
        displayNumber: "12",
        categoryName: "Classe A",
        models: ["Modello X", { name: "Modello Y" }],
        optedIn: true,
        exhibitor: { name: "Mario Rossi", country: "IT", socials: { instagram: "https://instagram.com/mario" } }
      })
    });
    const user = userEvent.setup();
    renderWithProviders(<Socials language="en" />);
    await chooseEventAndSearch(user, "12");

    expect(await screen.findByText("Classe A")).toBeInTheDocument();
    expect(screen.getByText("Modello X, Modello Y")).toBeInTheDocument();
    expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Instagram" })).toHaveAttribute("href", "https://instagram.com/mario");
  });

  it("tells the visitor when the exhibitor has not opted in", async () => {
    mockPublicApi({
      "13": () => ({ displayNumber: "13", categoryName: "Classe B", models: [], optedIn: false, exhibitor: null })
    });
    const user = userEvent.setup();
    renderWithProviders(<Socials language="en" />);
    await chooseEventAndSearch(user, "13");

    expect(await screen.findByText("The exhibitor chose not to make their data public")).toBeInTheDocument();
    expect(screen.queryByText("Mario Rossi")).not.toBeInTheDocument();
  });

  it("shows the not-found message for an unknown display number", async () => {
    mockPublicApi({ "99": () => { throw new ApiError(404, "nf"); } });
    const user = userEvent.setup();
    renderWithProviders(<Socials language="en" />);
    await chooseEventAndSearch(user, "99");

    expect(await screen.findByText("No display found with this number.")).toBeInTheDocument();
  });

  it("shows the not-available message when the server answers NOT_AVAILABLE_YET", async () => {
    mockPublicApi({ "7": () => { throw new ApiError(403, "NOT_AVAILABLE_YET"); } });
    const user = userEvent.setup();
    renderWithProviders(<Socials language="en" />);
    await chooseEventAndSearch(user, "7");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("The data will be visible at the end of judging")).toBeInTheDocument();
  });
});
