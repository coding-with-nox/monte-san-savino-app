import React from "react";
import { screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));

import MissingModelsCard from "../admin/MissingModelsCard";

const EVENTS = [{ id: "e1", name: "Event One", status: "active" }];
const CATEGORIES = [
  { id: "c1", eventId: "e1", name: "Cat A", status: "open" },
  { id: "c9", eventId: "e2", name: "Other", status: "open" }
];
const MODELS = [
  { id: "m1", name: "Model A", categoryId: "c1", missing: false },
  { id: "m2", name: "Model B", categoryId: "c1", missing: true },
  { id: "m9", name: "Model Z", categoryId: "c9", missing: false }
];

function renderCard(onChanged = vi.fn()) {
  return renderWithProviders(
    <MissingModelsCard language="en" events={EVENTS} categories={CATEGORIES as any} models={MODELS} onChanged={onChanged} />
  );
}

describe("MissingModelsCard", () => {
  beforeEach(() => {
    apiMock.mockReset().mockResolvedValue({});
  });

  it("lists only the models of the chosen event, with their missing state", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Event One" }));

    const rowA = screen.getByText("Model A").closest("tr") as HTMLElement;
    const rowB = screen.getByText("Model B").closest("tr") as HTMLElement;
    expect(screen.queryByText("Model Z")).not.toBeInTheDocument();
    expect(within(rowA).getByRole("checkbox")).not.toBeChecked();
    expect(within(rowB).getByRole("checkbox")).toBeChecked();
    expect(rowB.querySelector(".MuiChip-root")).toHaveTextContent("Missing");
    expect(rowA.querySelector(".MuiChip-root")).toBeNull();
  });

  it("calls PATCH /admin/models/:id/missing with the new flag and refreshes the list", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    renderCard(onChanged);
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Event One" }));

    const rowA = screen.getByText("Model A").closest("tr") as HTMLElement;
    await user.click(within(rowA).getByRole("checkbox"));

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith("/admin/models/m1/missing", {
      method: "PATCH",
      body: JSON.stringify({ missing: true })
    }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Model status updated.")).toBeInTheDocument();
  });

  it("explains a 409 as a closed class and does not report success", async () => {
    apiMock.mockReset().mockRejectedValue(Object.assign(new Error("CATEGORY_NOT_CLOSED"), { status: 409 }));
    const user = userEvent.setup();
    const onChanged = vi.fn();
    renderCard(onChanged);
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Event One" }));

    await user.click(within(screen.getByText("Model A").closest("tr") as HTMLElement).getByRole("checkbox"));

    expect(await screen.findByText("Class closed: the model status cannot be changed.")).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();
  });
});
