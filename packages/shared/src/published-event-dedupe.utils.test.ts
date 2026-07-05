import { describe, expect, it } from "vitest";

import {
  groupPublishedEventsByContent,
  pickCanonicalPublishedEvent,
  planPublishedOrphanDeletions,
  type PublishedEventAuditRow
} from "./published-event-dedupe.utils.js";

const ringlingScrape: PublishedEventAuditRow = {
  id: "evt-scrape",
  slug: "ringling-scrape",
  title: "Ringling Bros. And Barnum & Bailey Presents The Greatest Show On Earth",
  startTs: "2026-07-05T20:00:00.000-07:00",
  venueName: "Save Mart Center",
  source: "scrape:www.savemartcenter.com",
  occurrenceId: "occ-scrape"
};

const ringlingTicketmaster: PublishedEventAuditRow = {
  id: "evt-tm",
  slug: "ringling-tm",
  title: "  Ringling Bros.  And Barnum & Bailey Presents The Greatest Show On Earth ",
  startTs: "2026-07-05T20:00:00.000-07:00",
  venueName: "Save Mart Center",
  source: "ticketmaster",
  occurrenceId: "occ-tm"
};

const otherShow: PublishedEventAuditRow = {
  id: "evt-other",
  slug: "garden-bros",
  title: "Garden Brothers Circus",
  startTs: "2026-07-05T19:00:00.000-07:00",
  venueName: "Fresno Fairgrounds",
  source: "ticketmaster",
  occurrenceId: "occ-other"
};

describe("groupPublishedEventsByContent", () => {
  it("groups cosmetic title variants at the same venue and start", () => {
    const groups = groupPublishedEventsByContent([ringlingScrape, ringlingTicketmaster, otherShow]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.map((row) => row.id).sort()).toEqual(["evt-scrape", "evt-tm"]);
  });
});

describe("pickCanonicalPublishedEvent", () => {
  it("prefers the event duplicate candidates point at", () => {
    const votes = new Map([
      ["evt-scrape", 3],
      ["evt-tm", 0]
    ]);
    expect(pickCanonicalPublishedEvent([ringlingTicketmaster, ringlingScrape], votes).id).toBe("evt-scrape");
  });

  it("prefers venue scraper over ticketmaster when votes tie", () => {
    expect(pickCanonicalPublishedEvent([ringlingTicketmaster, ringlingScrape], new Map()).id).toBe("evt-scrape");
  });
});

describe("planPublishedOrphanDeletions", () => {
  it("plans deletion of non-canonical published duplicates", () => {
    const plan = planPublishedOrphanDeletions(
      [ringlingScrape, ringlingTicketmaster, otherShow],
      new Map([["evt-scrape", 2]])
    );

    expect(plan).toEqual([
      {
        eventId: "evt-tm",
        slug: "ringling-tm",
        title: ringlingTicketmaster.title,
        keepEventId: "evt-scrape",
        keepSlug: "ringling-scrape",
        reason: "content_duplicate_published"
      }
    ]);
  });
});
