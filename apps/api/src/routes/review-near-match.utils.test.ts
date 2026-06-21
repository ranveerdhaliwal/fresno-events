import { describe, expect, it } from "vitest";

import type { EventCandidate, NormalizedEvent } from "@fresno-events/shared";

import { rankNearMatchCandidates } from "@/routes/review-near-match.utils";

function makeCandidate(
  id: string,
  title: string,
  source: EventCandidate["source"],
  occurrenceId: string,
  startTs: string,
  venueName: string
): EventCandidate {
  const normalizedEvent: NormalizedEvent = {
    source,
    sourceEventId: id,
    title,
    venueName,
    startTs,
    category: "music"
  };

  return {
    id,
    source,
    sourceEventId: id,
    title,
    venueName,
    startTs,
    detailStatus: "complete",
    normalizedEvent,
    rawPayload: {},
    dedupeHash: id,
    confidenceScore: 0.9,
    status: "pending_review",
    occurrenceId,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  };
}

describe("rankNearMatchCandidates", () => {
  it("ranks Lil Wayne cross-source rows as near matches", () => {
    const anchor = makeCandidate(
      "tm",
      "LIL WAYNE: 20 YEARS OF CARTER CLASSICS WITH THE GAME",
      "ticketmaster",
      "occ-tm",
      "2026-08-29T02:00:00.000Z",
      "Save Mart Center"
    );
    const venunite = makeCandidate(
      "eb",
      "Lil Wayne Live in Fresno - 20 Years of Carter Classics Tour",
      "venunite",
      "occ-eb",
      "2026-08-29T03:00:00.000Z",
      "Save Mart Center at Fresno State - SMG"
    );

    const matches = rankNearMatchCandidates(anchor, [anchor, venunite], new Set());
    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe("eb");
    expect(matches[0]?.sharedWordCount).toBeGreaterThanOrEqual(5);
  });

  it("excludes same occurrence siblings and duplicates", () => {
    const anchor = makeCandidate("a", "Jazz Night", "ticketmaster", "occ-1", "2026-06-01T02:00:00.000Z", "Tower Theatre");
    const sibling = makeCandidate("b", "Jazz Night", "venunite", "occ-1", "2026-06-01T02:00:00.000Z", "Tower Theatre");
    const duplicate = { ...sibling, id: "c", status: "duplicate" as const };

    const matches = rankNearMatchCandidates(anchor, [anchor, sibling, duplicate], new Set(["b"]));
    expect(matches).toHaveLength(0);
  });
});
