import { describe, expect, it } from "vitest";

import type { EventCandidate } from "@fresno-events/shared";

import { filterCandidatesForSearch } from "./admin-review-search.utils";

const candidate = (overrides: Partial<EventCandidate> & Pick<EventCandidate, "id" | "title">): EventCandidate =>
  ({
    id: overrides.id,
    title: overrides.title,
    venueName: overrides.venueName ?? "Save Mart Center",
    source: overrides.source ?? "ticketmaster",
    status: overrides.status ?? "pending_review",
    startTs: overrides.startTs ?? "2026-06-01T02:00:00.000Z",
    confidenceScore: overrides.confidenceScore ?? 0.9,
    normalizedEvent: overrides.normalizedEvent ?? {
      source: "ticketmaster",
      sourceEventId: overrides.id,
      title: overrides.title,
      venueName: overrides.venueName ?? "Save Mart Center",
      startTs: overrides.startTs ?? "2026-06-01T02:00:00.000Z",
      category: "other"
    }
  }) as EventCandidate;

describe("filterCandidatesForSearch", () => {
  it("matches title, venue, and source across statuses", () => {
    const rows = [
      candidate({ id: "1", title: "Miss California 2026", source: "ticketmaster" }),
      candidate({ id: "2", title: "Monster Jam", venueName: "Save Mart Center", source: "scrape:www.savemartcenter.com" })
    ];

    expect(filterCandidatesForSearch(rows, "miss california")).toHaveLength(1);
    expect(filterCandidatesForSearch(rows, "savemart")).toHaveLength(1);
  });

  it("requires at least two characters", () => {
    const rows = [candidate({ id: "1", title: "Miss California 2026" })];
    expect(filterCandidatesForSearch(rows, "m")).toHaveLength(0);
  });

  it("matches venue names for filtered search (e.g. visalia)", () => {
    const rows = [
      candidate({ id: "1", title: "Visalia Rawhide vs. San Jose Giants", venueName: "Valley Strong Ballpark" }),
      candidate({ id: "2", title: "Monster Jam", venueName: "Save Mart Center" })
    ];
    expect(filterCandidatesForSearch(rows, "visalia")).toHaveLength(1);
    expect(filterCandidatesForSearch(rows, "valley strong")).toHaveLength(1);
  });
});
