import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { SectionTitle } from "./SectionTitle";

describe("SectionTitle", () => {
  it("capitalizes the script and inserts a hyphen by default", () => {
    renderWithProviders(
      <SectionTitle script="what's" size="md">
        HAPPENING
      </SectionTitle>
    );

    expect(screen.getByText("What's")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.getByText("HAPPENING")).toBeInTheDocument();
  });

  it("keeps script tight without a hyphen when scriptJoin is tight", () => {
    renderWithProviders(
      <SectionTitle script="search" size="lg" scriptJoin="tight">
        EVENTS
      </SectionTitle>
    );

    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.queryByText("-")).not.toBeInTheDocument();
    expect(screen.getByText("EVENTS")).toBeInTheDocument();
  });
});
