import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "@/tests/render";

import { NearMatchSection } from "./NearMatchSection";

describe("NearMatchSection", () => {
  it("renders near match candidates", () => {
    renderWithProviders(
      <NearMatchSection
        nearMatchCandidates={[
          {
            id: "near-1",
            sourceEventId: "df-1",
            title: "Tower Art Hop Afterglow",
            source: "api:downtownfresno",
            status: "pending_review",
            titleSimilarityScore: 0.82,
            sharedWordCount: 2,
            similarityLabel: "high overlap",
            sharedWords: ["tower", "art"],
            sourceUrl: "https://example.com/near"
          }
        ]}
        onSelectCandidate={vi.fn()}
      />
    );

    expect(screen.getByRole("region", { name: "Possibly the same show" })).toBeInTheDocument();
    expect(screen.getByText("Tower Art Hop Afterglow")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review" })).toBeInTheDocument();
  });
});
