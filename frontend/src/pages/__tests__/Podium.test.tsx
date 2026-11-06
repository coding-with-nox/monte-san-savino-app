import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ api: (...a: unknown[]) => apiMock(...a) }));

import Podium from "../Podium";

describe("Podium", () => {
  beforeEach(() => {
    apiMock.mockReset().mockImplementation(async (path: string) => {
      if (path === "/events") return [{ id: "e1", name: "MSS 2026" }];
      if (path === "/categories") return [{ id: "c1", name: "Armor" }];
      if (path === "/awards/events/e1")
        return [
          { modelId: "a", modelName: "Gold Tank", categoryId: "c1", medalLabel: "Gold", medalRank: 4 },
          { modelId: "b", modelName: "Bronze Tank", categoryId: "c1", medalLabel: "Bronze", medalRank: 2 }
        ];
      return [];
    });
  });

  it("reveals winners step by step, lowest medal first, with keyboard navigation", async () => {
    renderWithProviders(<MemoryRouter><Podium language="en" /></MemoryRouter>);
    fireEvent.mouseDown(await screen.findByLabelText("Select event"));
    fireEvent.click(await screen.findByRole("option", { name: "MSS 2026" }));
    fireEvent.click(screen.getByRole("button", { name: "Start ceremony" }));
    expect(await screen.findByTestId("podium-class")).toHaveTextContent("Armor");
    const revealed = () => screen.getAllByTestId("podium-winner").map((w) => w.getAttribute("data-revealed"));
    expect(revealed()).toEqual(["false", "false"]);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(revealed()).toEqual(["true", "false"]);
    expect(screen.getByText("Bronze Tank")).toBeInTheDocument();
    expect(screen.queryByText("Gold Tank")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Gold Tank")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(revealed()).toEqual(["true", "false"]);
  });
});
