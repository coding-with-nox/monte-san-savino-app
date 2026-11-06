import React from "react";
import { screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ api: (...a: unknown[]) => apiMock(...a) }));

import ModelMoveCard from "../ModelMoveCard";

function pick(label: string, option: string) {
  fireEvent.mouseDown(screen.getByLabelText(label));
  fireEvent.click(within(screen.getByRole("listbox")).getByText(option));
}

describe("ModelMoveCard", () => {
  beforeEach(() => { apiMock.mockReset().mockResolvedValue({}); });

  it("asks for confirmation before moving the model", async () => {
    const onMoved = vi.fn();
    renderWithProviders(
      <ModelMoveCard language="en" models={[{ id: "m1", name: "Tank", categoryId: "c1" }]} categories={[{ id: "c1", name: "Armor" }, { id: "c2", name: "Air" }]} onMoved={onMoved} />
    );
    pick("Model", "Tank");
    pick("New class", "Air");
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(apiMock).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(onMoved).toHaveBeenCalled());
    expect(apiMock).toHaveBeenCalledWith("/admin/models/m1", { method: "PUT", body: JSON.stringify({ categoryId: "c2" }) });
  });

  it("keeps Move disabled when the target is the current class", () => {
    renderWithProviders(
      <ModelMoveCard language="en" models={[{ id: "m1", name: "Tank", categoryId: "c1" }]} categories={[{ id: "c1", name: "Armor" }]} />
    );
    pick("Model", "Tank");
    pick("New class", "Armor");
    expect(screen.getByRole("button", { name: "Move" })).toBeDisabled();
  });
});
