import React from "react";
import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import SocialLinks from "../SocialLinks";

describe("SocialLinks", () => {
  it("renders safe external links with noopener noreferrer", () => {
    renderWithProviders(
      <SocialLinks language="en" instagram="https://instagram.com/mario" facebook="facebook.com/mario" website="http://example.com" />
    );
    const insta = screen.getByRole("link", { name: "Instagram" });
    expect(insta).toHaveAttribute("href", "https://instagram.com/mario");
    expect(insta).toHaveAttribute("target", "_blank");
    expect(insta).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("link", { name: "Facebook" })).toHaveAttribute("href", "https://facebook.com/mario");
    expect(screen.getByRole("link", { name: "Website" })).toHaveAttribute("href", "http://example.com/");
  });

  it("never renders links for non-http(s) schemes", () => {
    renderWithProviders(<SocialLinks language="en" instagram="javascript:alert(1)" website="data:text/html,x" />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("No links")).toBeInTheDocument();
  });
});
