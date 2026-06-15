import React from "react";
import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PageContainer from "../PageContainer";
import { renderWithProviders } from "../../test/renderWithProviders";

describe("PageContainer", () => {
  it("renders children", () => {
    renderWithProviders(
      <PageContainer>
        <span>Hello world</span>
      </PageContainer>
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    renderWithProviders(
      <PageContainer>
        <span>First</span>
        <span>Second</span>
      </PageContainer>
    );
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("renders with default maxWidth md without crashing", () => {
    const { container } = renderWithProviders(
      <PageContainer>
        <span>content</span>
      </PageContainer>
    );
    expect(container.querySelector(".MuiContainer-maxWidthMd")).toBeInTheDocument();
  });

  it("renders with custom maxWidth sm", () => {
    const { container } = renderWithProviders(
      <PageContainer maxWidth="sm">
        <span>content</span>
      </PageContainer>
    );
    expect(container.querySelector(".MuiContainer-maxWidthSm")).toBeInTheDocument();
  });
});
