import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { EventRowSkeleton } from "./EventRowSkeleton";

describe("EventRowSkeleton", () => {
  it("renders placeholder row", () => {
    renderWithProviders(<EventRowSkeleton />);
    expect(screen.getByTestId("event-row-skeleton")).toBeInTheDocument();
  });
});
