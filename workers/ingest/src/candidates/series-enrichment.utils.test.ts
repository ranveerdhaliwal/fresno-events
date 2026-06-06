import { describe, expect, it } from "vitest";

import { enrichmentSeriesListingUrl } from "./series-enrichment.utils";

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
