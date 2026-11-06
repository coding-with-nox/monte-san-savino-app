import React from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({
  ApiError: class extends Error {},
  api: (...args: unknown[]) => apiMock(...args),
  API_BASE: "/api"
}));

import PrintActions from "../PrintActions";

describe("PrintActions", () => {
  beforeEach(() => {
    apiMock.mockReset();
    apiMock.mockResolvedValue("<html></html>");
    window.URL.createObjectURL = vi.fn(() => "blob:x");
    window.URL.revokeObjectURL = vi.fn();
    window.open = vi.fn() as any;
  });

  it("opens the list export with the given filters", async () => {
    renderWithProviders(<PrintActions language="it" params={{ eventId: "e1", categoryId: "c1" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Stampa lista" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/exports/models/print?eventId=e1&categoryId=c1"));
    expect(window.open).toHaveBeenCalled();
  });

  it("opens the label export for a single model", async () => {
    renderWithProviders(<PrintActions language="it" params={{ modelId: "m1" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Stampa etichetta" }));
    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/exports/labels/pdf?modelId=m1"));
  });
});
