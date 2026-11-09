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

  it("fetches the badge HTML through the authenticated api and opens it in a new tab", async () => {
    apiMock.mockResolvedValueOnce("<html><body>BADGE</body></html>");
    const createUrl = vi.fn(() => "blob:badge");
    const openSpy = vi.fn();
    vi.stubGlobal("open", openSpy);
    window.URL.createObjectURL = createUrl as any;
    window.URL.revokeObjectURL = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="en" />);
    await user.type(screen.getByLabelText("Enrollment ID"), "e9");
    await user.click(screen.getByRole("button", { name: "Print badge" }));
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith("blob:badge", "_blank", "noopener,noreferrer"));
    expect(apiMock).toHaveBeenCalledWith("/staff/print/e9");
    const blob = (createUrl.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toContain("text/html");
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.readAsText(blob);
    });
    expect(text).toContain("BADGE");
    expect(screen.queryByText("Check-in completed.")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("shows the backend message when the badge is not found (404)", async () => {
    apiMock.mockRejectedValueOnce(Object.assign(new Error("Enrollment not found"), { status: 404 }));
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="en" />);
    await user.type(screen.getByLabelText("Enrollment ID"), "e9");
    await user.click(screen.getByRole("button", { name: "Print badge" }));
    expect(await screen.findByText("Enrollment not found")).toBeInTheDocument();
  });

  it("falls back to a clear message for an empty 422 error", async () => {
    apiMock.mockRejectedValueOnce(Object.assign(new Error(""), { status: 422 }));
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="en" />);
    await user.type(screen.getByLabelText("Enrollment ID"), "e9");
    await user.click(screen.getByRole("button", { name: "Print badge" }));
    expect(await screen.findByText("Badge not available for this enrollment.")).toBeInTheDocument();
  });

  it("shows an error when printing fails", async () => {
    apiMock.mockRejectedValueOnce(new Error("Printer offline"));
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="it" />);
    await user.type(screen.getByLabelText("Enrollment ID"), "e9");
    await user.click(screen.getByRole("button", { name: "Stampa badge" }));
    await waitFor(() => expect(screen.getByText("Printer offline")).toBeInTheDocument());
  });

  it("does not call the API and shows a validation error for an empty or blank id on check-in", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="en" />);
    await user.click(screen.getByRole("button", { name: "Check-in" }));
    expect(await screen.findByText("Enter the enrollment ID.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Enrollment ID"), "   ");
    await user.click(screen.getByRole("button", { name: "Check-in" }));
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("does not call the API for a blank id when printing the badge", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="it" />);
    await user.type(screen.getByLabelText("Enrollment ID"), "  ");
    await user.click(screen.getByRole("button", { name: "Stampa badge" }));
    expect(await screen.findByText("Inserisci l'ID iscrizione.")).toBeInTheDocument();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("trims the id before calling the API", async () => {
    apiMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderWithProviders(<StaffCheckin language="en" />);
    await user.type(screen.getByLabelText("Enrollment ID"), "  enr-7 ");
    await user.click(screen.getByRole("button", { name: "Check-in" }));
    expect(apiMock).toHaveBeenCalledWith("/staff/checkin/enr-7", { method: "POST" });
  });
});
