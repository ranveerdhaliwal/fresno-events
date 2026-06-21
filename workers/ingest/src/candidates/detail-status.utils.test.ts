import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import { VISIT_FRESNO_PRICE_NOT_LISTED } from "@/scrapers/visit-fresno-detail.utils";

import { canonicalDetailPageUrl, resolveCandidateDetailFields } from "./detail-status.utils";

const completeEvent: NormalizedEvent = {
  source: "scrape:www.strummersclub.com",
  sourceEventId: "https://www.strummersclub.com/shows/2026/6/6/agent-orange",
  title: "Agent Orange",
  venueName: "Strummers",
  startTs: "2026-06-07T02:00:00.000Z",
  category: "music",
  descriptionText: "Live show",
  externalUrl: "https://www.strummersclub.com/shows/2026/6/6/agent-orange?format=ical"
};

describe("canonicalDetailPageUrl", () => {
  it("strips ical query params", () => {
    expect(canonicalDetailPageUrl(completeEvent)).toBe(
      "https://www.strummersclub.com/shows/2026/6/6/agent-orange"
    );
  });

  it("prefers Eventbrite ticket URL for venunite EB-backed rows", () => {
    const venunite: NormalizedEvent = {
      source: "venunite",
      sourceEventId: "eb:123",
      title: "BarrelHouse Anniversary Party",
      venueName: "BarrelHouse",
      startTs: "2026-06-07T02:00:00.000Z",
      category: "community",
      externalUrl: "https://www.eventbrite.com/e/barrelhouse-anniversary-party-tickets-1990516589703",
      tags: ["venunite", "venunite_slug:barrelhouse-anniversary-party"]
    };
    expect(canonicalDetailPageUrl(venunite)).toBe(
      "https://www.eventbrite.com/e/event-1990516589703"
    );
  });
});

describe("resolveCandidateDetailFields", () => {
  it("marks complete when review fields are sufficient", () => {
    expect(resolveCandidateDetailFields(completeEvent)).toEqual({
      detail_status: "complete",
      detail_page_url: "https://www.strummersclub.com/shows/2026/6/6/agent-orange"
    });
  });

  it("marks detail complete for non-Visit sources even without description", () => {
    const { descriptionText: _d, ...sparse } = completeEvent;
    expect(resolveCandidateDetailFields(sparse).detail_status).toBe("complete");
  });

  it("marks MiLB detail complete without description (API-embedded)", () => {
    const game: NormalizedEvent = {
      source: "api:milb",
      sourceEventId: "milb:game:1",
      title: "Fresno Grizzlies vs Modesto",
      venueName: "Chukchansi Park",
      startTs: "2026-06-15T02:00:00.000Z",
      category: "sports",
      externalUrl: "https://www.milb.com/fresno"
    };
    expect(resolveCandidateDetailFields(game).detail_status).toBe("complete");
  });

  it("keeps Visit Fresno pending until price is on the event", () => {
    const visit: NormalizedEvent = {
      source: "api:visitfresnocounty",
      sourceEventId: "occ-1",
      title: "Miss California Competition Week",
      venueName: "William Saroyan Theatre",
      startTs: "2026-06-20T02:00:00.000Z",
      category: "festival",
      descriptionText: "Week of competition",
      externalUrl: "https://www.visitfresnocounty.org/event/miss-california-competition-week/9109/"
    };
    expect(resolveCandidateDetailFields(visit).detail_status).toBe("pending");
    expect(
      resolveCandidateDetailFields({ ...visit, priceNotes: "see website for details" }).detail_status
    ).toBe("complete");
  });

  it("marks Visit Fresno complete when detail backfill found no price field", () => {
    const visit: NormalizedEvent = {
      source: "api:visitfresnocounty",
      sourceEventId: "occ-cobra",
      title: "The Cobra Comedy Open Mic",
      venueName: "The Cobra",
      startTs: "2026-06-03T02:00:00.000Z",
      descriptionText: "Open mic",
      externalUrl: "https://www.visitfresnocounty.org/event/the-cobra-comedy-open-mic/4874/"
    };
    expect(
      resolveCandidateDetailFields({ ...visit, priceNotes: VISIT_FRESNO_PRICE_NOT_LISTED }).detail_status
    ).toBe("complete");
  });

  it("marks Visit Fresno complete after price even without category (pre-enrichment)", () => {
    const visit: NormalizedEvent = {
      source: "api:visitfresnocounty",
      sourceEventId: "occ-2",
      title: "Fresno Street Eats",
      venueName: "Eaton Plaza",
      startTs: "2026-06-26T12:00:00.000Z",
      descriptionText: "Food trucks",
      externalUrl: "https://www.visitfresnocounty.org/event/fresno-street-eats/8615/",
      isFree: true,
      currency: "USD"
    };
    expect(resolveCandidateDetailFields(visit).detail_status).toBe("complete");
  });
});
