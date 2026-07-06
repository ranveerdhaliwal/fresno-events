import { describe, expect, it, vi } from "vitest";

import type { EventCandidate } from "@fresno-events/shared";

import { renderWithProviders, screen } from "@/tests/render";

vi.mock("@/features/admin-location/AdminLocationPicker", () => ({
  AdminLocationPicker: () => <div data-testid="admin-location-picker" />
}));

vi.mock("./SeriesLinkPanel", () => ({
  SeriesLinkPanel: () => <div data-testid="series-link-panel" />
}));

import { CandidateDetail } from "./CandidateDetail";

const candidate = {
  id: "cand-1",
  source: "api:visitfresnocounty",
  sourceEventId: "evt-1",
  title: "Tower Art Hop",
  venueName: "Warnors Theatre",
  startTs: "2026-05-22T20:00:00.000-07:00",
  normalizedEvent: {
    source: "api:visitfresnocounty",
    sourceEventId: "evt-1",
    title: "Tower Art Hop",
    venueName: "Warnors Theatre",
    venueCity: "Fresno",
    startTs: "2026-05-22T20:00:00.000-07:00",
    category: "art"
  },
  rawPayload: {},
  dedupeHash: "abc",
  confidenceScore: 0.87,
  suggestedPriority: 1,
  status: "pending_review",
  detailStatus: "complete",
  occurrenceId: "occ-1",
  createdAt: "2026-04-25T08:00:00.000Z",
  updatedAt: "2026-04-25T08:00:00.000Z"
} satisfies EventCandidate;

describe("CandidateDetail", () => {
  it("renders candidate detail form", () => {
    renderWithProviders(
      <CandidateDetail
        token="test-token"
        candidate={candidate}
        linkedCandidates={[]}
        displayPriority={3}
        onPriorityChange={vi.fn()}
        onAfterDecision={vi.fn()}
        onSeriesUpdated={vi.fn()}
        onSelectCandidate={vi.fn()}
        onOpenPrimary={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Tower Art Hop" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Approve" }).length).toBeGreaterThan(0);
    expect(screen.getByTestId("series-link-panel")).toBeInTheDocument();
  });
});
