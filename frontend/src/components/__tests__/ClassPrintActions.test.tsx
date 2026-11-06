import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const openMock = vi.fn();
vi.mock("../../lib/exports", () => ({ openHtmlExport: (...a: unknown[]) => openMock(...a) }));

import ClassPrintActions from "../ClassPrintActions";

describe("ClassPrintActions", () => {
  beforeEach(() => { openMock.mockReset().mockResolvedValue(undefined); });

  it("opens the three class exports", async () => {
    renderWithProviders(<ClassPrintActions language="en" categoryId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Exhibitors" }));
    await waitFor(() => expect(openMock).toHaveBeenCalledWith("/exports/classes/c1/exhibitors"));
    fireEvent.click(screen.getByRole("button", { name: "Jury QR" }));
    await waitFor(() => expect(openMock).toHaveBeenCalledWith("/exports/classes/c1/jury-qr"));
    fireEvent.click(screen.getByRole("button", { name: "Jury List" }));
    await waitFor(() => expect(openMock).toHaveBeenCalledWith("/exports/classes/c1/jury-list"));
  });

  it("shows an error toast when the export fails", async () => {
    openMock.mockImplementation(() => Promise.reject({ message: "boom" }));
    renderWithProviders(<ClassPrintActions language="en" categoryId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Exhibitors" }));
    expect(await screen.findByText("boom")).toBeInTheDocument();
  });
});
