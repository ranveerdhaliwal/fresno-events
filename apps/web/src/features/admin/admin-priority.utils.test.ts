// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { EventCandidate, EventSource, NormalizedEvent } from "@fresno-events/shared";

import {
  buildSeriesDisplayPriorities,
  compareCandidatesWithinSource,
  groupCandidatesByPriority,
  groupCandidatesBySource,
  listDisplayPriority,
  queueDisplayPriority,
  sortCandidatesByReviewedAt,
  sortCandidatesForReview,
  sortCandidatesForSourceGroupedReview,
  sortCandidatesWithinSource
} from "./admin-priority.utils";

const LISTING_URL = "https://www.visitfresnocounty.org/event/fort-washington-farmers-market/1234";

function makeCandidate(
  id: string,
  title: string,
  startTs: string,
  suggestedPriority: number | undefined,
  externalUrl: string = LISTING_URL,
  source: EventSource = "api:visitfresnocounty",
  confidenceScore = 0.7
): EventCandidate {
  const normalizedEvent: NormalizedEvent = {
    source,
    sourceEventId: id,
    title,
    venueName: "Riverview Shopping Center",
    startTs,
    externalUrl
  };

  return {
    id,
    source,
    sourceEventId: id,
    title,
    venueName: "Riverview Shopping Center",
    startTs,
    detailStatus: "complete",
    detailPageUrl: externalUrl,
    normalizedEvent,
    rawPayload: {},
    dedupeHash: id,
    confidenceScore,
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
    expect(listDisplayPriority(items[0]!, seriesPriorities, {})).toBe(4);
    expect(listDisplayPriority(items[1]!, seriesPriorities, {})).toBe(4);
    expect(listDisplayPriority(items[3]!, seriesPriorities, {})).toBe(4);
  });

  it("keeps a recurring series in one priority section (legacy priority groups)", () => {
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

  it("does not unify display priority across different titles in a venue-season series", () => {
    const seriesId = "series:bigfresnofair:2026";
    const withSeries = (id: string, title: string, startTs: string, priority: number): EventCandidate => ({
      ...makeCandidate(id, title, startTs, priority, `https://www.fresnofair.com/events/${id}`, "scrape:www.fresnofair.com"),
      normalizedEvent: {
        ...makeCandidate(id, title, startTs, priority, `https://www.fresnofair.com/events/${id}`, "scrape:www.fresnofair.com")
          .normalizedEvent,
        seriesId,
        seriesName: "Big Fresno Fair"
      }
    });

    const items = [
      withSeries("headliner", "R&B Night Out with Ashanti & Soul For Real", "2026-10-10T02:00:00.000Z", 2),
      withSeries("flea-1", "Fresno Flea Market", "2026-10-16T13:00:00.000Z", 4),
      withSeries("flea-2", "Fresno Flea Market", "2026-10-17T13:00:00.000Z", 4)
    ];

    const seriesPriorities = buildSeriesDisplayPriorities(items, {});
    expect(listDisplayPriority(items[0]!, seriesPriorities, {})).toBe(2);
    expect(listDisplayPriority(items[1]!, seriesPriorities, {})).toBe(4);
    expect(listDisplayPriority(items[2]!, seriesPriorities, {})).toBe(4);
  });
});

describe("source grouping", () => {
  it("groups by source and sorts by priority within each source", () => {
    const items = [
      makeCandidate("tm-p2", "TM P2", "2026-08-01T00:00:00.000Z", 2, "https://tm.example/a", "ticketmaster"),
      makeCandidate("tm-p1", "TM P1", "2026-08-02T00:00:00.000Z", 1, "https://tm.example/b", "ticketmaster"),
      makeCandidate("vf-p3", "VF P3", "2026-08-03T00:00:00.000Z", 3, LISTING_URL, "api:visitfresnocounty")
    ];

    const groups = groupCandidatesBySource(items, {});
    expect(groups).toHaveLength(2);
    expect(groups[0]?.source).toBe("ticketmaster");
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["tm-p1", "tm-p2"]);
    expect(groups[1]?.source).toBe("api:visitfresnocounty");
    expect(groups[1]?.items.map((item) => item.id)).toEqual(["vf-p3"]);
  });

  it("flat sort order matches group order for navigation", () => {
    const items = [
      makeCandidate("tm-p2", "TM P2", "2026-08-01T00:00:00.000Z", 2, "https://tm.example/a", "ticketmaster"),
      makeCandidate("tm-p1", "TM P1", "2026-08-02T00:00:00.000Z", 1, "https://tm.example/b", "ticketmaster"),
      makeCandidate("vf-p3", "VF P3", "2026-08-03T00:00:00.000Z", 3, LISTING_URL, "api:visitfresnocounty")
    ];

    const flat = sortCandidatesForSourceGroupedReview(items, {});
    const fromGroups = groupCandidatesBySource(items, {}).flatMap((group) => group.items);
    expect(flat.map((item) => item.id)).toEqual(fromGroups.map((item) => item.id));
  });

  it("sorts by priority then chronological date within a source", () => {
    const items = [
      makeCandidate("gb-aug-29", "Game Aug 29", "2026-08-29T18:00:00.000Z", 4, "https://g.example/4", "api:gobulldogs"),
      makeCandidate("gb-aug-15", "Game Aug 15", "2026-08-15T18:00:00.000Z", 4, "https://g.example/1", "api:gobulldogs"),
      makeCandidate("gb-aug-22", "Game Aug 22", "2026-08-22T18:00:00.000Z", 4, "https://g.example/2", "api:gobulldogs"),
      makeCandidate("gb-p1", "Marquee", "2026-09-01T18:00:00.000Z", 1, "https://g.example/5", "api:gobulldogs")
    ];

    const sorted = sortCandidatesWithinSource(items, {}, new Map());
    expect(sorted.map((item) => item.id)).toEqual(["gb-p1", "gb-aug-15", "gb-aug-22", "gb-aug-29"]);
  });

  it("uses date before confidence when priority matches", () => {
    const items = [
      makeCandidate("later", "Later", "2026-08-22T18:00:00.000Z", 4, "https://g.example/b", "api:gobulldogs", 0.99),
      makeCandidate("earlier", "Earlier", "2026-08-15T18:00:00.000Z", 4, "https://g.example/a", "api:gobulldogs", 0.5)
    ];

    expect(compareCandidatesWithinSource(items[0]!, items[1]!, {}, new Map())).toBeGreaterThan(0);
    expect(sortCandidatesWithinSource(items, {}, new Map()).map((item) => item.id)).toEqual([
      "earlier",
      "later"
    ]);
  });

  it("orders higher-priority rows before later dates", () => {
    const items = [
      makeCandidate("p4-soon", "P4 soon", "2026-08-10T18:00:00.000Z", 4, "https://g.example/a", "api:gobulldogs"),
      makeCandidate("p1-later", "P1 later", "2026-09-01T18:00:00.000Z", 1, "https://g.example/b", "api:gobulldogs")
    ];

    expect(sortCandidatesWithinSource(items, {}, new Map()).map((item) => item.id)).toEqual(["p1-later", "p4-soon"]);
  });
});

describe("sortCandidatesByReviewedAt", () => {
  it("orders approved rows with the most recently reviewed first", () => {
    const older = {
      ...makeCandidate("older", "Older Event", "2026-07-07T17:00:00.000Z", 4),
      status: "approved" as const,
      reviewedAt: "2026-06-01T10:00:00.000Z"
    };
    const newer = {
      ...makeCandidate("newer", "Newer Event", "2026-07-08T17:00:00.000Z", 4),
      status: "approved" as const,
      reviewedAt: "2026-06-13T18:08:45.000Z"
    };

    expect(sortCandidatesByReviewedAt([older, newer]).map((item) => item.id)).toEqual(["newer", "older"]);
  });
});

describe("queueDisplayPriority", () => {
  it("uses publishedPriority on the approved tab when present", () => {
    const candidate = {
      ...makeCandidate("a", "George Lopez", "2026-10-24T03:00:00.000Z", 3),
      status: "approved" as const,
      publishedPriority: 2
    };

    expect(queueDisplayPriority(candidate, {}, true)).toBe(2);
    expect(queueDisplayPriority(candidate, {}, false)).toBe(3);
    expect(queueDisplayPriority(candidate, { a: 4 }, true)).toBe(4);
  });
});
