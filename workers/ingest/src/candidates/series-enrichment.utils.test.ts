import { describe, expect, it } from "vitest";

import type { EnrichmentCandidateRow } from "@/candidates/enrichment-candidate.utils";

import { enrichmentSeriesListingUrl, seriesHarmonizeFilterParams } from "./series-enrichment.utils";

function row(overrides: Partial<EnrichmentCandidateRow> = {}): EnrichmentCandidateRow {
  return {
    id: "cand-1",
    status: "pending_review",
    confidence_score: 0.95,
    review_notes: null,
    suggested_priority: 2,
    normalized_event: {
      source: "scrape:www.fresnofair.com",
      sourceEventId: "venue:big-fresno-fair:411:2026-10-23",
      title: "Fresno Flea Market",
      venueName: "Big Fresno Fair",
      startTs: "2026-10-23T13:00:00.000Z",
      seriesId: "series:bigfresnofair:2026"
    },
    ...overrides
  };
}

describe("enrichmentSeriesListingUrl", () => {
  it("strips ical query and trailing slash", () => {
    expect(
      enrichmentSeriesListingUrl({
        source: "api:visitfresnocounty",
        sourceEventId: "x",
        title: "Market",
        venueName: "Plaza",
        startTs: "2026-07-01T12:00:00.000Z",
        externalUrl: "https://www.visitfresnocounty.org/event/market/123/?format=ical"
      })
    ).toBe("https://www.visitfresnocounty.org/event/market/123");
  });
});

describe("seriesHarmonizeFilterParams", () => {
  it("scopes venue-season series harmonize by title", () => {
    const params = seriesHarmonizeFilterParams(row());
    expect(params?.get("normalized_event->>seriesId")).toBe("eq.series:bigfresnofair:2026");
    expect(params?.get("title")).toBe("eq.Fresno Flea Market");
  });
});
