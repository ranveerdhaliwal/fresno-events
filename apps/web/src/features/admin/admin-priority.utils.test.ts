// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { EventCandidate, NormalizedEvent } from "@fresno-events/shared";

import {
  buildSeriesDisplayPriorities,
  groupCandidatesByPriority,
  listDisplayPriority,
  sortCandidatesForReview
} from "./admin-priority.utils";

const LISTING_URL = "https://www.visitfresnocounty.org/event/fort-washington-farmers-market/1234";

function makeCandidate(
  id: string,
  title: string,
  startTs: string,
  suggestedPriority: number | undefined,
  externalUrl: string = LISTING_URL
): EventCandidate {
  const normalizedEvent: NormalizedEvent = {
    source: "api:visitfresnocounty",
    sourceEventId: id,
    title,
    venueName: "Riverview Shopping Center",
    startTs,
    externalUrl
  };

  return {
    id,
    source: "api:visitfresnocounty",
    sourceEventId: id,
    title,
    venueName: "Riverview Shopping Center",
    startTs,
    detailStatus: "complete",
    detailPageUrl: externalUrl,
    normalizedEvent,
    rawPayload: {},
    dedupeHash: id,
    confidenceScore: 0.7,
    ...(suggestedPriority !== undefined ? { suggestedPriority } : {}),
    status: "pending_review",
    occurrenceId: id,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  };
}

describe("series display priority", () => {
  it("unifies priority for recurring rows that share a listing URL", () => {
    const items = [
      makeCandidate("a", "Fort Washington Farmers Market", "2026-07-07T17:00:00.000Z", 4),
      makeCandidate("b", "Fort Washington Farmers Market", "2026-07-14T17:00:00.000Z", 5),
      makeCandidate("c", "Fort Washington Farmers Market", "2026-07-21T17:00:00.000Z", 5),
      makeCandidate("d", "Fort Washington Farmers Market", "2026-07-28T17:00:00.000Z", 4)
    ];

    const seriesPriorities = buildSeriesDisplayPriorities(items, {});
    expect(listDisplayPriority(items[0], seriesPriorities, {})).toBe(4);
    expect(listDisplayPriority(items[1], seriesPriorities, {})).toBe(4);
    expect(listDisplayPriority(items[3], seriesPriorities, {})).toBe(4);
  });

  it("keeps a recurring series in one priority section", () => {
    const items = [
      makeCandidate("a", "Fort Washington Farmers Market", "2026-07-07T17:00:00.000Z", 4),
      makeCandidate("b", "Fort Washington Farmers Market", "2026-07-14T17:00:00.000Z", 5),
      makeCandidate("c", "Fort Washington Farmers Market", "2026-07-21T17:00:00.000Z", 5),
      makeCandidate("d", "Fort Washington Farmers Market", "2026-07-28T17:00:00.000Z", 4)
    ];

    const sorted = sortCandidatesForReview(items, {});
    const groups = groupCandidatesByPriority(sorted, {});

    expect(groups).toHaveLength(1);
    expect(groups[0]?.priority).toBe(4);
    expect(groups[0]?.items).toHaveLength(4);
  });

  it("does not unify unrelated one-off events", () => {
    const items = [
      makeCandidate("a", "Concert A", "2026-07-07T17:00:00.000Z", 4, "https://example.com/a"),
      makeCandidate("b", "Concert B", "2026-07-08T17:00:00.000Z", 5, "https://example.com/b")
    ];

    const groups = groupCandidatesByPriority(sortCandidatesForReview(items, {}), {});
    expect(groups).toHaveLength(2);
    expect(groups[0]?.priority).toBe(4);
    expect(groups[1]?.priority).toBe(5);
  });
});
