import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { LinkedSourcesSection } from "./LinkedSourcesSection";

describe("LinkedSourcesSection", () => {
  it("renders linked source rows", () => {
    renderWithProviders(
      <LinkedSourcesSection
        linkedCandidates={[
          {
            id: "linked-1",
            sourceEventId: "tm-1",
            title: "Tower Art Hop",
            source: "ticketmaster",
            status: "pending_review",
            sourceUrl: "https://example.com/event"
          }
        ]}
      />
    );

    expect(screen.getByText("Also listed on")).toBeInTheDocument();
    expect(screen.getByText("Tower Art Hop")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Source/i })).toBeInTheDocument();
  });
});
