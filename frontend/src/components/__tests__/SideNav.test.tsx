import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders } from "../../test/renderWithProviders";
import SideNav, { SIDE_NAV_STORAGE_KEY } from "../SideNav";

const items = [
  { label: "Home", path: "/", icon: <span data-testid="icon-home" /> },
  { label: "Models", path: "/models", icon: <span data-testid="icon-models" /> },
];
const render = () =>
  renderWithProviders(
    <MemoryRouter>
      <SideNav items={items} isActive={(path) => path === "/models"} language="en" />
    </MemoryRouter>
  );

describe("SideNav", () => {
  beforeEach(() => localStorage.clear());

  it("renders every entry with its icon and marks the active one", () => {
    render();
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Models" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("icon-home")).toBeInTheDocument();
    expect(screen.getByTestId("icon-models")).toBeInTheDocument();
  });

  it("collapses to icons only, expands again and remembers the state", () => {
    const first = render();
    const toggle = screen.getByRole("button", { name: "Collapse menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Expand menu" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Models")).not.toBeInTheDocument();
    // The accessible name survives through the tooltip label.
    expect(screen.getByRole("link", { name: "Models" })).toBeInTheDocument();
    expect(localStorage.getItem(SIDE_NAV_STORAGE_KEY)).toBe("true");

    first.unmount();
    render();
    fireEvent.click(screen.getByRole("button", { name: "Expand menu" }));
    expect(screen.getByText("Models")).toBeInTheDocument();
    expect(localStorage.getItem(SIDE_NAV_STORAGE_KEY)).toBe("false");
  });
});
