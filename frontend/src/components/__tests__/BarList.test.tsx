import React from "react";
import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import BarList from "../BarList";

describe("BarList", () => {
  it("scales bars relative to the maximum", () => {
    renderWithProviders(<BarList emptyLabel="none" items={[{ key: "a", label: "A", value: 10 }, { key: "b", label: "B", value: 5 }]} />);
    const fills = screen.getAllByTestId("bar-fill");
    expect(fills[0]).toHaveStyle({ width: "100%" });
    expect(fills[1]).toHaveStyle({ width: "50%" });
  });
  it("shows the empty label", () => {
    renderWithProviders(<BarList emptyLabel="none" items={[]} />);
    expect(screen.getByText("none")).toBeInTheDocument();
  });
});
