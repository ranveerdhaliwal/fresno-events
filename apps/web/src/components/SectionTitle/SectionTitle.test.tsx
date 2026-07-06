import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { SectionTitle } from "./SectionTitle";

describe("SectionTitle", () => {
  it("renders script accent and title", () => {
    renderWithProviders(
      <SectionTitle script="what's" size="md">
        HAPPENING
      </SectionTitle>
    );

    expect(screen.getByText("what's")).toBeInTheDocument();
    expect(screen.getByText("HAPPENING")).toBeInTheDocument();
  });
});
