import { describe, expect, it } from "vitest";

import type { EventCandidate } from "@fresno-events/shared";

import { buildAlternatesFromCandidates, mergeSourceRefsWithAlternates } from "./review-occurrence.utils";

const primary: EventCandidate = {
  id: "p1",
  source: "api:visitfresnocounty",
  sourceEventId: "v1",
  title: "Show",
  venueName: "Tower",
  startTs: "2026-06-01T02:00:00.000Z",
  normalizedEvent: {
    source: "api:visitfresnocounty",
    sourceEventId: "v1",
    title: "Show",
    venueName: "Tower",
    startTs: "2026-06-01T02:00:00.000Z",
    category: "music"
  },
  rawPayload: {},
  dedupeHash: "a",
  confidenceScore: 0.7,
  detailStatus: "pending",
  status: "pending_review",
  occurrenceId: "occ-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

describe("review-occurrence.utils", () => {
  it("merges alternates without duplicates", () => {
    const sibling: EventCandidate = {
      ...primary,
      id: "s1",
      source: "api:downtownfresno",
      sourceEventId: "d1",
      sourceUrl: "https://downtownfresno.com/event",
      status: "duplicate",
      canonicalCandidateId: "p1"
    };

    const merged = mergeSourceRefsWithAlternates(
      { candidate_id: "p1" },
      buildAlternatesFromCandidates(primary, [sibling])
    );

    expect(merged.alternates).toHaveLength(1);
    expect((merged.alternates as Array<{ source: string }>)[0]?.source).toBe("api:downtownfresno");
  });
});
