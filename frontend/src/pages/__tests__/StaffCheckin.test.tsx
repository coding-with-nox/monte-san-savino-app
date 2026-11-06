import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));

import StaffCheckin from "../StaffCheckin";

describe("StaffCheckin", () => {
  beforeEach(() => {
    apiMock.mockReset();
  });

  it("posts the check-in, confirms and clears the field", async () => {
    apiMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="en" />);
    const input = screen.getByLabelText("Enrollment ID");
    await user.type(input, "enr-1");
    await user.click(screen.getByRole("button", { name: "Check-in" }));
    expect(apiMock).toHaveBeenCalledWith("/staff/checkin/enr-1", { method: "POST" });
    expect(await screen.findByText("Check-in completed.")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("shows the API error and keeps the id when check-in fails", async () => {
    apiMock.mockRejectedValueOnce(new Error("Enrollment not found"));
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="en" />);
    await user.type(screen.getByLabelText("Enrollment ID"), "bad");
    await user.click(screen.getByRole("button", { name: "Check-in" }));
    expect(await screen.findByText("Enrollment not found")).toBeInTheDocument();
    expect(screen.getByLabelText("Enrollment ID")).toHaveValue("bad");
  });

  it("prints the badge and shows the server message", async () => {
    apiMock.mockResolvedValueOnce({ message: "Badge sent to printer" });
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="en" />);
    await user.type(screen.getByLabelText("Enrollment ID"), "e9");
    await user.click(screen.getByRole("button", { name: "Print badge" }));
    expect(apiMock).toHaveBeenCalledWith("/staff/print/e9");
    expect(await screen.findByText("Badge sent to printer")).toBeInTheDocument();
  });

  it("shows an error when printing fails", async () => {
    apiMock.mockRejectedValueOnce(new Error("Printer offline"));
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="it" />);
    await user.type(screen.getByLabelText("Enrollment ID"), "e9");
    await user.click(screen.getByRole("button", { name: "Stampa badge" }));
    await waitFor(() => expect(screen.getByText("Printer offline")).toBeInTheDocument());
  });
});
