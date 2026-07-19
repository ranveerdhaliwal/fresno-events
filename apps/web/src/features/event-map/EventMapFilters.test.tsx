import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { EventMapFilters } from "./EventMapFilters";

describe("EventMapFilters", () => {
  it("renders map filter controls", () => {
    renderWithProviders(
      <EventMapFilters
        q=""
        datePreset="week"
        omittedNoCoords={0}
        pinCount={12}
        onQueryChange={vi.fn()}
        onDatePresetChange={vi.fn()}
      />
    );

    expect(screen.getByRole("textbox", { name: "Map filter" })).toBeInTheDocument();
    expect(screen.getByText("12 pins")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "This week" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tonight" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Near Fresno" })).not.toBeInTheDocument();
  });
});
