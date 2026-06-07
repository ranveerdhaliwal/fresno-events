import { describe, expect, it } from "vitest";

import type { VenueConfig } from "@/venues/venue.types";

import { parseConventionListingHtml } from "./convention-listing.utils";
import configJson from "./venue.config.json";

const config = configJson as VenueConfig;

const SAMPLE = `
  <div class="c-row">
    <div class="c-column">
      <div class="cparagraph-abc text-output">
        <div><p><strong>ZZ Top</strong></p><p><strong>@ Saroyan Theatre</strong></p><p>August 7, 2026</p><p><strong>Show Time</strong>: 8 PM</p></div>
      </div>
      <a href="https://events.fresnoconventioncenter.com/zz-top">PURCHASE TICKETS</a>
    </div>
  </div>
`;

describe("parseConventionListingHtml", () => {
  it("parses Saroyan Theatre blocks from listing HTML", () => {
    const events = parseConventionListingHtml(SAMPLE, config, new Date("2026-06-05T12:00:00Z"));
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe("ZZ Top");
    expect(events[0]?.venueName).toBe("Saroyan Theatre");
    expect(events[0]?.externalUrl).toBe("https://events.fresnoconventioncenter.com/zz-top");
    expect(events[0]?.sourceEventId).toBe("venue:fresno-convention-center:zz-top");
  });
});
