import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import {
  buildDowntownFresnoUrl,
  buildDowntownWindows,
  DOWNTOWN_FRESNO_BBQ_KEY,
  mergeListingWithDetail,
  parseDowntownFresnoHtml
} from "./downtown-fresno-api.utils";

const fixturePath = join(
  process.cwd(),
  "../../tools/spikes/fixtures/downtown-fresno-sample.html"
);

describe("downtown-fresno-api.utils", () => {
  it("buildDowntownWindows returns 14-day chunks", () => {
    const windows = buildDowntownWindows(new Date("2026-05-23T12:00:00Z"), 14, 28);
    expect(windows.length).toBeGreaterThanOrEqual(2);
    expect(windows[0]).toMatch(/^\d{2}-\d{2}-\d{2}-to-\d{2}-\d{2}-\d{2}$/);
  });

  it("parses HTML fixture into events", () => {
    const html = readFileSync(fixturePath, "utf8");
    const events = parseDowntownFresnoHtml(html, new Date("2026-05-23T12:00:00Z"));
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]?.source).toBe("api:downtownfresno");
    expect(events[0]?.externalUrl).toContain("downtownfresno.org");
  });

  it("buildDowntownFresnoUrl embeds hardcoded fid and key", () => {
    const url = buildDowntownFresnoUrl("05-23-26-to-06-06-26");
    expect(url).toContain("fid=22");
    expect(url).toContain(`key=${DOWNTOWN_FRESNO_BBQ_KEY}`);
  });

  it("mergeListingWithDetail prefers LLM fields and keeps sourceEventId", () => {
    const listing: NormalizedEvent = {
      source: "api:downtownfresno",
      sourceEventId: "https://www.downtownfresno.org/do/sample",
      title: "Listing title",
      venueName: "Downtown Oak",
      startTs: "2026-05-23T19:00:00.000Z",
      externalUrl: "https://www.downtownfresno.org/do/sample",
      category: "community"
    };

    const merged = mergeListingWithDetail(listing, {
      title: "Detail title",
      venueName: "Warnors Center",
      startTs: "2026-09-22T19:00:00.000Z",
      descriptionText: "Full description from detail page."
    });

    expect(merged.title).toBe("Detail title");
    expect(merged.venueName).toBe("Warnors Center");
    expect(merged.descriptionText).toBe("Full description from detail page.");
    expect(merged.sourceEventId).toBe(listing.sourceEventId);
  });

  it("mergeListingWithDetail returns listing when detail invalid", () => {
    const listing: NormalizedEvent = {
      source: "api:downtownfresno",
      sourceEventId: "https://www.downtownfresno.org/do/x",
      title: "Only listing",
      venueName: "Venue",
      startTs: "2026-05-23T12:00:00.000Z",
      category: "community"
    };
    expect(mergeListingWithDetail(listing, null)).toEqual(listing);
  });
});
