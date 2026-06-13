import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import EmptyState from "../EmptyState";
import { renderWithProviders } from "../../test/renderWithProviders";

describe("EmptyState", () => {
  it("renders title message", () => {
    renderWithProviders(<EmptyState title="Nothing here yet" />);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    renderWithProviders(
      <EmptyState title="No data" description="Try adding something first." />
    );
    expect(screen.getByText("Try adding something first.")).toBeInTheDocument();
  });

  it("renders an svg icon", () => {
    const { container } = renderWithProviders(<EmptyState title="Empty" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders custom icon when icon prop is provided", () => {
    renderWithProviders(
      <EmptyState title="Empty" icon={<span data-testid="custom-icon" />} />
    );
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("renders action button when action prop is provided", () => {
    renderWithProviders(
      <EmptyState title="Empty" action={{ label: "Add item", onClick: vi.fn() }} />
    );
    expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument();
  });

  it("fires action callback when button is clicked", async () => {
    const handleClick = vi.fn();
    renderWithProviders(
      <EmptyState title="Empty" action={{ label: "Add item", onClick: handleClick }} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Add item" }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not render a button when action prop is omitted", () => {
    renderWithProviders(<EmptyState title="Empty" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
