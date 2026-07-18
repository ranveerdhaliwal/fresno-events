import { describe, expect, it } from "vitest";

import type { EventCandidate } from "@fresno-events/shared";

import { toSeriesSiblingCandidate } from "./series.utils.js";

describe("toSeriesSiblingCandidate", () => {
  it("maps candidate fields for admin series list", () => {
    const candidate: EventCandidate = {
      id: "cand-1",
      source: "api:visitfresnocounty",
      sourceEventId: "occ-1",
      title: "Backyard 101 - Trivia",
      venueName: "The Backyard Social Club",
      startTs: "2026-06-03T02:00:00.000Z",
      normalizedEvent: {
        source: "api:visitfresnocounty",
        sourceEventId: "occ-1",
        title: "Backyard 101 - Trivia",
        venueName: "The Backyard Social Club",
        startTs: "2026-06-03T02:00:00.000Z",
        externalUrl: "https://example.com/event/1",
        seriesName: "Recurring weekly on Tuesday"
      },
      rawPayload: {},
      dedupeHash: "hash",
      confidenceScore: 0.9,
      detailStatus: "complete",
      status: "pending_review",
      occurrenceId: "occ-id",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z"
    };

    expect(toSeriesSiblingCandidate(candidate)).toEqual({
      id: "cand-1",
      source: "api:visitfresnocounty",
      sourceEventId: "occ-1",
      title: "Backyard 101 - Trivia",
      startTs: "2026-06-03T02:00:00.000Z",
      venueName: "The Backyard Social Club",
      status: "pending_review",
      sourceUrl: "https://example.com/event/1"
    });
  });
});
