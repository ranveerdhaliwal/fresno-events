import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { PrimaryCandidateBanner } from "./PrimaryCandidateBanner";

describe("PrimaryCandidateBanner", () => {
  it("renders linked primary candidate banner", () => {
    renderWithProviders(
      <PrimaryCandidateBanner
        primaryCandidate={{
          id: "primary-1",
          sourceEventId: "evt-1",
          title: "Tower Art Hop",
          source: "api:visitfresnocounty",
          status: "pending_review"
        }}
        onOpenPrimary={vi.fn()}
      />
    );

    expect(screen.getByText("Linked to another source")).toBeInTheDocument();
    expect(screen.getByText("Tower Art Hop")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open primary row" })).toBeInTheDocument();
  });
});
