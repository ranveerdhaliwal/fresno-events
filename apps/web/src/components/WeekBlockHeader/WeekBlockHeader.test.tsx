import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { WeekBlockHeader } from "./WeekBlockHeader";

describe("WeekBlockHeader", () => {
  it("renders capitalized events script, outlined label, and day cue", () => {
    renderWithProviders(<WeekBlockHeader label="TODAY" dateLabel="Sat, Jul 18" />);

    expect(screen.getByTestId("week-block-header")).toBeInTheDocument();
    expect(screen.getByText("Events")).toBeInTheDocument();
    expect(screen.getByText("TODAY")).toBeInTheDocument();
    expect(screen.getByText("Sat, Jul 18")).toBeInTheDocument();
  });
});
