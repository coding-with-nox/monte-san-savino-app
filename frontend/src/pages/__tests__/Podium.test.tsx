import React from "react";
import { screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
vi.mock("../../lib/api", () => ({ api: (...a: unknown[]) => apiMock(...a) }));

import Podium from "../Podium";

const ceremony = {
  classes: [
    {
      categoryId: "c1",
      name: "Armor",
      classNumber: 1,
      presentationOrder: 1,
      prizes: [
        { medalLabel: "Bronze", medalRank: 2, displayNumber: 3, modelName: "Bronze Tank", modelCode: "BT", wholeDisplay: false },
        { medalLabel: "Gold", medalRank: 4, displayNumber: 5, modelName: "Gold Tank", modelCode: "GT", wholeDisplay: false }
      ]
    },
    {
      categoryId: "c2",
      name: "Figures",
      classNumber: 2,
      presentationOrder: 2,
      prizes: [{ medalLabel: "Gold", medalRank: 4, displayNumber: 9, modelName: null, modelCode: null, wholeDisplay: true }]
    }
  ],
  honors: [
    { code: "bos", name: "Best of Show", sortOrder: 1, categoryName: "Armor", displayNumber: 5, modelName: "Gold Tank", wholeDisplay: false },
    { code: "trophy-a", name: "Trophy A", sortOrder: 2, categoryName: "Figures", displayNumber: 9, modelName: null, wholeDisplay: true }
  ]
};

describe("Podium", () => {
  beforeEach(() => {
    apiMock.mockReset().mockImplementation(async (path: string) => {
      if (path === "/events") return [{ id: "e1", name: "MSS 2026" }];
      if (path === "/awards/events/e1/ceremony") return ceremony;
      return [];
    });
  });

  async function startCeremony() {
    renderWithProviders(<MemoryRouter><Podium language="en" /></MemoryRouter>);
    fireEvent.mouseDown(await screen.findByLabelText("Select event"));
    fireEvent.click(await screen.findByRole("option", { name: "MSS 2026" }));
    fireEvent.click(screen.getByRole("button", { name: "Start ceremony" }));
    expect(await screen.findByTestId("podium-class")).toHaveTextContent("Armor");
  }

  const revealed = () => screen.getAllByTestId("podium-winner").map((w) => w.getAttribute("data-revealed"));
  const next = () => fireEvent.keyDown(window, { key: "ArrowRight" });
  const back = () => fireEvent.keyDown(window, { key: "ArrowLeft" });

  it("reveals winners step by step, lowest medal first, with keyboard navigation", async () => {
    await startCeremony();
    expect(revealed()).toEqual(["false", "false"]);
    next();
    expect(revealed()).toEqual(["true", "false"]);
    expect(screen.getByText("Bronze Tank")).toBeInTheDocument();
    expect(screen.queryByText("Gold Tank")).not.toBeInTheDocument();
    next();
    expect(screen.getByText("Gold Tank")).toBeInTheDocument();
    back();
    expect(revealed()).toEqual(["true", "false"]);
  });

  it("goes class by class (title first, then prizes), then special awards with Best of Show last", async () => {
    await startCeremony();
    expect(screen.getByText("Step 1 / 7")).toBeInTheDocument();
    next();
    next();
    next();
    expect(screen.getByTestId("podium-class")).toHaveTextContent("Figures");
    expect(revealed()).toEqual(["false"]);
    next();
    expect(screen.getByText("Whole display")).toBeInTheDocument();
    next();
    expect(screen.getByTestId("podium-honor")).toHaveTextContent("Trophy A");
    next();
    expect(screen.getByTestId("podium-honor")).toHaveTextContent("Best of Show");
    expect(screen.getByText("Step 7 / 7")).toBeInTheDocument();
    next();
    expect(screen.getByText("Step 7 / 7")).toBeInTheDocument();
  });
  it("announces the exhibitor, with display number and what was awarded underneath", async () => {
    ceremony.classes[0].prizes[0] = { ...ceremony.classes[0].prizes[0], exhibitor: "Luca Bianchi" } as any;
    ceremony.honors[1] = { ...ceremony.honors[1], exhibitor: "Mario Rossi" } as any;
    try {
      await startCeremony();
      next();
      expect(screen.getByText("Luca Bianchi")).toBeInTheDocument();
      expect(screen.getByText("Display 3 · Bronze Tank")).toBeInTheDocument();
      for (let i = 0; i < 4; i++) next();
      expect(screen.getByTestId("podium-honor")).toHaveTextContent("Trophy A");
      expect(screen.getByText("Mario Rossi")).toBeInTheDocument();
      expect(screen.getByText("Display 9 · Whole display")).toBeInTheDocument();
    } finally {
      delete (ceremony.classes[0].prizes[0] as any).exhibitor;
      delete (ceremony.honors[1] as any).exhibitor;
    }
  });
});
