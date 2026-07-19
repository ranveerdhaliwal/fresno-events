import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders its message", () => {
    renderWithProviders(<EmptyState>No events scheduled</EmptyState>);

    expect(screen.getByText("No events scheduled")).toBeInTheDocument();
  });

  it("forwards data-testid", () => {
    renderWithProviders(<EmptyState data-testid="my-empty-state">Nothing here</EmptyState>);

    expect(screen.getByTestId("my-empty-state")).toBeInTheDocument();
  });
});
