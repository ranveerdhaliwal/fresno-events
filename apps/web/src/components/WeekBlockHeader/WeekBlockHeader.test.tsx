import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { WeekBlockHeader } from "./WeekBlockHeader";

describe("WeekBlockHeader", () => {
  it("renders script label and date range", () => {
    renderWithProviders(<WeekBlockHeader label="This week" dateRange="Jun 8 – Jun 14" />);

    expect(screen.getByTestId("week-block-header")).toBeInTheDocument();
    expect(screen.getByText("next")).toBeInTheDocument();
    expect(screen.getByText("This week")).toBeInTheDocument();
    expect(screen.getByText("Jun 8 – Jun 14")).toBeInTheDocument();
  });
});
