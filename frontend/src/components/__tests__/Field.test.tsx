import React from "react";
import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Field, { EmptyValue } from "../Field";
import { renderWithProviders } from "../../test/renderWithProviders";

describe("Field", () => {
  it("renders label text", () => {
    renderWithProviders(<Field label="Email" value="test@example.com" />);
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("renders string value when provided", () => {
    renderWithProviders(<Field label="City" value="Florence" />);
    expect(screen.getByText("Florence")).toBeInTheDocument();
  });

  it("renders EmptyValue placeholder when value is undefined", () => {
    renderWithProviders(<Field label="Phone" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders EmptyValue placeholder when value is empty string", () => {
    renderWithProviders(<Field label="Phone" value="" />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders a ReactNode value correctly", () => {
    renderWithProviders(
      <Field label="Role" value={<span data-testid="chip">admin</span>} />
    );
    expect(screen.getByTestId("chip")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });
});

describe("EmptyValue", () => {
  it("renders a non-empty DOM with an em dash", () => {
    renderWithProviders(<EmptyValue />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
