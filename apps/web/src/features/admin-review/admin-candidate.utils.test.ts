// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { EventCandidate } from "@fresno-events/shared";

import { toCandidateEventRowViewModel } from "./admin-candidate.utils";

const baseCandidate = {
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
  createdAt: "2026-04-25T08:00:00.000Z",
  updatedAt: "2026-04-25T08:00:00.000Z"
} satisfies EventCandidate;

describe("toCandidateEventRowViewModel", () => {
  it("maps priority and confidence to row props", () => {
    const row = toCandidateEventRowViewModel(baseCandidate, 1, { aiSuggested: true });
    expect(row.priority).toBe(1);
    expect(row.priceLabel).toBe("87%");
    expect(row.flagLabel).toBe("HUGE");
    expect(row.categoryLabel).toContain("AI");
  });
});
