import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ api: (...a: unknown[]) => apiMock(...a) }));

import AbsentToggle from "../AbsentToggle";

describe("AbsentToggle", () => {
  beforeEach(() => { apiMock.mockReset(); });

  it("PATCHes the absent flag and notifies", async () => {
    apiMock.mockResolvedValue({});
    const onChanged = vi.fn();
    renderWithProviders(<AbsentToggle language="en" enrollmentId="e1" absent={false} onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(true));
    expect(apiMock).toHaveBeenCalledWith("/admin/enrollments/e1/absent", { method: "PATCH", body: JSON.stringify({ absent: true }) });
    expect(await screen.findByText("Marked as absent")).toBeInTheDocument();
  });

  it("reports errors without changing state", async () => {
    apiMock.mockImplementation(async () => { throw new Error("nope"); });
    const onChanged = vi.fn();
    renderWithProviders(<AbsentToggle language="en" enrollmentId="e1" absent onChanged={onChanged} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(await screen.findByText("nope")).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
