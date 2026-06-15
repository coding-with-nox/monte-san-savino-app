import React from "react";
import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import SectionCard from "../SectionCard";
import { renderWithProviders } from "../../test/renderWithProviders";

describe("SectionCard", () => {
  it("renders title text", () => {
    renderWithProviders(
      <SectionCard title="My Title">
        <span>body</span>
      </SectionCard>
    );
    expect(screen.getByText("My Title")).toBeInTheDocument();
  });

  it("renders children content", () => {
    renderWithProviders(
      <SectionCard title="T">
        <span>child content</span>
      </SectionCard>
    );
    expect(screen.getByText("child content")).toBeInTheDocument();
  });

  it("renders icon badge when icon prop is provided", () => {
    renderWithProviders(
      <SectionCard title="T" icon={<span data-testid="my-icon">icon</span>}>
        <span>body</span>
      </SectionCard>
    );
    expect(screen.getByTestId("my-icon")).toBeInTheDocument();
  });

  it("renders action node when action prop is provided", () => {
    renderWithProviders(
      <SectionCard title="T" action={<button>Click me</button>}>
        <span>body</span>
      </SectionCard>
    );
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("does not render action button when action prop is omitted", () => {
    renderWithProviders(
      <SectionCard title="T">
        <span>body</span>
      </SectionCard>
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
