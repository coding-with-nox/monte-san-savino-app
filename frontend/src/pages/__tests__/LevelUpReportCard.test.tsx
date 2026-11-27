import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
const downloadMock = vi.fn();

vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));
vi.mock("../../lib/download", () => ({ downloadAuthenticatedFile: (...a: unknown[]) => downloadMock(...a) }));

import LevelUpReportCard from "../admin/LevelUpReportCard";

const events = [{ id: "e1", name: "Show 2026" }];
const rows = [
  {
    participantNumber: 12,
    name: "Anna Verdi",
    email: "anna@b.it",
    models: [
      { name: "Dread", code: "12A1", categoryName: "Historical" },
      { name: "Orc", code: null, categoryName: "Fantasy" }
    ]
  }
];

async function chooseEvent(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: /select event/i }));
  await user.click(await screen.findByRole("option", { name: "Show 2026" }));
}

describe("Admin: move-up to Masters report", () => {
  beforeEach(() => {
    apiMock.mockReset();
    downloadMock.mockReset();
  });

  it("loads the report of the chosen event into a table", async () => {
    apiMock.mockResolvedValue(rows);
    const user = userEvent.setup();
    renderWithProviders(<LevelUpReportCard language="en" events={events} />);
    await chooseEvent(user);

    expect(await screen.findByText("Anna Verdi")).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith("/admin/reports/level-up?eventId=e1");
    const table = screen.getByRole("table", { name: "Move-up to Masters report" });
    expect(table).toHaveTextContent("Participant no.");
    expect(table).toHaveTextContent("12");
    expect(table).toHaveTextContent("anna@b.it");
    expect(table).toHaveTextContent("Dread (12A1, Historical); Orc (-, Fantasy)");
  });

  it("says when there is nobody to move up", async () => {
    apiMock.mockResolvedValue([]);
    const user = userEvent.setup();
    renderWithProviders(<LevelUpReportCard language="en" events={events} />);
    await chooseEvent(user);
    expect(await screen.findByText("No users to move up to Masters for this event.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("downloads the Excel report only after an event is chosen", async () => {
    apiMock.mockResolvedValue(rows);
    downloadMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithProviders(<LevelUpReportCard language="en" events={events} />);
    expect(screen.getByRole("button", { name: "Download Excel" })).toBeDisabled();

    await chooseEvent(user);
    await user.click(await screen.findByRole("button", { name: "Download Excel" }));
    expect(downloadMock).toHaveBeenCalledWith("/admin/reports/level-up/excel?eventId=e1", "level-up-e1.xlsx");
  });
});
