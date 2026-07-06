import { describe, expect, it, vi } from "vitest";

import type { EventCandidate } from "@fresno-events/shared";

import { renderWithProviders, screen } from "@/tests/render";

vi.mock("@/features/admin-location/AdminLocationPicker", () => ({
  AdminLocationPicker: () => <div data-testid="admin-location-picker" />
}));

import { CandidateChangeDetail } from "./CandidateChangeDetail";

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

describe("CandidateChangeDetail", () => {
  it("renders candidate change detail form", () => {
    renderWithProviders(
      <CandidateChangeDetail
        token="test-token"
        candidate={candidate}
        displayPriority={3}
        onAfterDecision={vi.fn()}
        onOpenPrimary={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Tower Art Hop" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Approve update" }).length).toBeGreaterThan(0);
  });
});
