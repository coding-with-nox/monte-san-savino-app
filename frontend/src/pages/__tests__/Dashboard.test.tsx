import React from "react";
import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";

const apiMock = vi.fn();
let roleValue: string = "user";
vi.mock("../../lib/api", () => ({ ApiError: class extends Error {}, api: (...a: unknown[]) => apiMock(...a) }));
vi.mock("../../lib/auth", () => ({
  getRole: () => roleValue,
  roleAtLeast: (actual: string, min: string) => {
    const order = ["user", "staff", "judge", "manager", "admin"];
    return order.indexOf(actual) >= order.indexOf(min);
  }
}));

import Dashboard from "../Dashboard";

function renderDash() {
  return renderWithProviders(<MemoryRouter><Dashboard language="en" /></MemoryRouter>);
}

describe("Dashboard", () => {
  beforeEach(() => { apiMock.mockReset(); });

  it("shows own models and enrollment status for a user", async () => {
    roleValue = "user";
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/models") return [{ id: "m1", name: "Space Marine" }];
      if (path === "/enrollments") return [{ id: "en1", eventId: "e1", checkedIn: true }];
      if (path.startsWith("/public/events")) return [{ id: "e1", name: "MSS 2026" }];
      return [];
    });
    renderDash();
    expect(await screen.findByText("Space Marine")).toBeInTheDocument();
    expect(screen.getByText("MSS 2026")).toBeInTheDocument();
    expect(screen.getByText("Checked in")).toBeInTheDocument();
  });

  it("shows categories still to be judged for a judge", async () => {
    roleValue = "judge";
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/judge/events") return [{ eventId: "e1", eventName: "MSS 2026" }];
      if (path.startsWith("/judge/models"))
        return [
          { id: "1", categoryId: "c1", categoryName: "Historical", currentRank: 2 },
          { id: "2", categoryId: "c1", categoryName: "Historical", currentRank: null },
          { id: "3", categoryId: "c2", categoryName: "Sci-fi", currentRank: 1 }
        ];
      return [];
    });
    renderDash();
    expect(await screen.findByText("Historical")).toBeInTheDocument();
    expect(screen.getByText("1/2 voted")).toBeInTheDocument();
    expect(screen.queryByText("Sci-fi")).not.toBeInTheDocument();
  });

  it("shows enrollment, check-in and scoring totals for a manager", async () => {
    roleValue = "manager";
    apiMock.mockImplementation(async (path: string) => {
      if (path === "/public/events") return [{ id: "e1", name: "MSS 2026" }];
      if (path.startsWith("/admin/enrollments"))
        return [{ id: "1", eventId: "e1", checkedIn: true }, { id: "2", eventId: "e1", checkedIn: false }];
      if (path.startsWith("/awards/monitoring"))
        return [{ categoryId: "c", categoryName: "C", totalModels: 10, scoredModels: 4, totalJudges: 3, completedJudges: 1 }];
      return [];
    });
    renderDash();
    expect(await screen.findByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("4/10")).toBeInTheDocument();
  });
});
