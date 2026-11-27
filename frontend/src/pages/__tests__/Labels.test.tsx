import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a), API_BASE: "/api" }));
const downloadMock = vi.fn();
vi.mock("../../lib/download", () => ({ downloadAuthenticatedFile: (...a: unknown[]) => downloadMock(...a) }));
const dymoMock = vi.fn();
vi.mock("../../lib/dymo", () => ({ DymoSdkError: class extends Error {}, printDymoLabels: (...a: unknown[]) => dymoMock(...a) }));

import Labels from "../Labels";

const STATS = { participants: 12, models: 30, labels: 30, listPages: 4, envelopes: 12 };

async function pickEvent(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: "Event One" }));
}

describe("Labels: front desk prints", () => {
  beforeEach(() => {
    apiMock.mockReset().mockImplementation(async (path: string) => {
      if (path === "/events") return [{ id: "e1", name: "Event One", status: "open" }];
      if (path.startsWith("/exports/events/e1/desk/stats")) return STATS;
      return "<html></html>";
    });
    downloadMock.mockReset().mockResolvedValue(undefined);
    dymoMock.mockReset().mockResolvedValue("printed");
    window.URL.createObjectURL = vi.fn(() => "blob:x");
    window.URL.revokeObjectURL = vi.fn();
    window.open = vi.fn() as any;
  });

  it("keeps the desk buttons disabled until an event is chosen", async () => {
    renderWithProviders(<Labels language="en" />);
    expect(screen.getByRole("button", { name: "Print labels" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Calculate material" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Excel" })).toBeDisabled();
  });

  it("opens the labels, lists and envelopes with the from/to range", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Labels language="en" />);
    await pickEvent(user);
    await user.type(screen.getByLabelText("From participant number"), "3");
    await user.type(screen.getByLabelText("To participant number"), "9");

    await user.click(screen.getByRole("button", { name: "Print labels" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/exports/events/e1/desk/labels?from=3&to=9&lang=it"));
    await user.click(screen.getByRole("button", { name: "Print model lists" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/exports/events/e1/desk/lists?from=3&to=9&lang=it"));
    await user.click(screen.getByRole("button", { name: "Print envelopes (DL)" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/exports/events/e1/desk/envelopes?from=3&to=9&lang=it"));
    expect(window.open).toHaveBeenCalledTimes(3);
  });

  it("sends no range when the from/to fields are empty", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Labels language="en" />);
    await pickEvent(user);
    await user.click(screen.getByRole("button", { name: "Print model lists" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/exports/events/e1/desk/lists?lang=it"));
  });

  it("prints the DYMO rows of the desk with the same range", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Labels language="en" />);
    await pickEvent(user);
    await user.type(screen.getByLabelText("From participant number"), "3");
    await user.click(screen.getByRole("button", { name: "DYMO labels" }));
    await waitFor(() =>
      expect(dymoMock).toHaveBeenCalledWith({ from: "3", to: undefined }, "/exports/events/e1/desk/labels/data")
    );
    expect(await screen.findByText("Labels sent to DYMO printer.")).toBeInTheDocument();
  });

  it("calculates the material and shows the stats", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Labels language="en" />);
    await pickEvent(user);
    await user.type(screen.getByLabelText("From participant number"), "3");
    await user.type(screen.getByLabelText("To participant number"), "9");
    await user.click(screen.getByRole("button", { name: "Calculate material" }));

    expect(await screen.findByText("Participants: 12")).toBeInTheDocument();
    expect(screen.getByText("Models: 30")).toBeInTheDocument();
    expect(screen.getByText("Labels: 30")).toBeInTheDocument();
    expect(screen.getByText("List pages: 4")).toBeInTheDocument();
    expect(screen.getByText("Envelopes: 12")).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith("/exports/events/e1/desk/stats?from=3&to=9&lang=it");
  });

  it("opens the photographers list as HTML and downloads it as Excel", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Labels language="en" />);
    await pickEvent(user);
    await user.click(screen.getByRole("button", { name: "HTML" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/exports/events/e1/photography?lang=it"));
    await user.click(screen.getByRole("button", { name: "Excel" }));
    await waitFor(() => expect(downloadMock).toHaveBeenCalledWith("/exports/events/e1/photography/excel", "fotografi-e1.xlsx"));
  });
});
