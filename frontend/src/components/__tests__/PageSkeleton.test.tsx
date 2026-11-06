import React from "react";
import { screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import PageSkeleton from "../PageSkeleton";

describe("PageSkeleton", () => {
  it("renders a busy placeholder for every variant", () => {
    for (const variant of ["table", "cards", "form"] as const) {
      const { unmount } = renderWithProviders(<PageSkeleton variant={variant} rows={3} />);
      expect(screen.getByTestId("page-skeleton")).toHaveAttribute("aria-busy", "true");
      unmount();
    }
  });
});
