import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import {
  buildDowntownFresnoUrl,
  buildDowntownWindows,
  DOWNTOWN_FRESNO_BBQ_KEY,
  looksLikeDowntownTimeOnly,
  mergeListingWithDetail,
  parseDowntownDetailHtml,
  parseDowntownFresnoHtml,
  parseDowntownSecondary,
  parseDowntownDetailDescription,
  parseDowntownDetailTicketUrl,
  resolveDowntownDetailImage
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

  it("anchors listing times to Pacific, not UTC", () => {
    // 7:00 PM PT on 2026-05-23 (PDT, UTC-7) = 2026-05-24T02:00:00Z.
    const html = `
      <div class="bbq-row">
        <span class="bbqdate-month">May</span>
        <span class="bbqdate-day">23</span>
        <ul class="bbq-row-list">
          <li><a href="/do/show">
            <span class="lnk-primary">Evening Show</span>
            <span class="lnk-secondary">7:00 PM / Warnors</span>
          </a></li>
        </ul>
      </div>`;
    const events = parseDowntownFresnoHtml(html, new Date("2026-05-01T12:00:00Z"));
    expect(events[0]?.startTs).toBe("2026-05-24T02:00:00.000Z");
  });

  it("uses the noon-UTC all-day sentinel when no time is present", () => {
    const html = `
      <div class="bbq-row">
        <span class="bbqdate-month">May</span>
        <span class="bbqdate-day">23</span>
        <ul class="bbq-row-list">
          <li><a href="/do/allday">
            <span class="lnk-primary">All Day Fair</span>
            <span class="lnk-secondary">Downtown Plaza</span>
          </a></li>
        </ul>
      </div>`;
    const events = parseDowntownFresnoHtml(html, new Date("2026-05-01T12:00:00Z"));
    expect(events[0]?.startTs).toBe("2026-05-23T12:00:00.000Z");
    expect(events[0]?.venueName).toBe("Downtown Plaza");
  });

  it("does not treat a time-only secondary line as the venue name", () => {
    const html = `
      <div class="bbq-row">
        <span class="bbqdate-month">Jun</span>
        <span class="bbqdate-day">27</span>
        <ul class="bbq-row-list">
          <li><a href="/do/makerfest-on-broadway-presented-by-fresno-ideaworks">
            <span class="lnk-primary">Makerfest on Broadway Presented by Fresno Ideaworks</span>
            <span class="lnk-secondary">10am - 3pm</span>
          </a></li>
        </ul>
      </div>`;
    const events = parseDowntownFresnoHtml(html, new Date("2026-06-01T12:00:00Z"));
    expect(events[0]?.venueName).toBe("Downtown Fresno");
    expect(events[0]?.startTs).toBe("2026-06-27T17:00:00.000Z");
  });

  it("parseDowntownSecondary splits time and venue around a slash", () => {
    expect(parseDowntownSecondary("7:00 PM / Warnors")).toEqual({
      timePart: "7:00 PM",
      venuePart: "Warnors"
    });
    expect(looksLikeDowntownTimeOnly("10am - 3pm")).toBe(true);
    expect(parseDowntownSecondary("10am - 3pm")).toEqual({
      timePart: "10am - 3pm",
      venuePart: null
    });
    expect(parseDowntownSecondary("Warnors Center for the Performing Arts")).toEqual({
      timePart: "",
      venuePart: "Warnors Center for the Performing Arts"
    });
  });

  it("parseDowntownDetailHtml reads venue and address from the Location block", () => {
    const listing: NormalizedEvent = {
      source: "api:downtownfresno",
      sourceEventId: "https://www.downtownfresno.org/do/sweet-revenge-a-tribute-to-my-chemical-romance",
      title: "SWEET REVENGE",
      venueName: "7:30pm",
      startTs: "2026-08-01T12:00:00.000Z",
      category: "community"
    };
    const html = `
      <span class="dldate">Saturday, Aug 1, 2026</span><span class="dltime">7:30pm</span>
      <h2 class="on-detail">Location</h2>
      <div class="awesome-box"><div class="awesome-box-link"><p>Fulton 55</p></div></div>`;
    const merged = parseDowntownDetailHtml(html, listing, new Date("2026-06-01T12:00:00Z"));
    expect(merged.venueName).toBe("Fulton 55");
    expect(merged.startTs).toBe("2026-08-02T02:30:00.000Z");
  });

  it("parseDowntownDetailHtml extracts linked venue name and street line", () => {
    const listing: NormalizedEvent = {
      source: "api:downtownfresno",
      sourceEventId: "https://www.downtownfresno.org/do/pride-night-jenni-rivera-tribute",
      title: "Pride Night",
      venueName: "On A Roll Sushi ⚾",
      startTs: "2026-06-21T00:30:00.000Z",
      category: "community"
    };
    const html = `
      <h2 class="on-detail">Location</h2>
      <div class="awesome-box"><div class="awesome-box-link"><p><a href="/go/on-a-roll-sushi">On A Roll Sushi ⚾</a><br />1306 Van Ness Ave</p></div></div>`;
    const merged = parseDowntownDetailHtml(html, listing);
    expect(merged.venueName).toBe("On A Roll Sushi ⚾");
    expect(merged.venueAddress).toBe("1306 Van Ness Ave");
  });

  it("parseDowntownDetailHtml ignores prose Location blocks for venueName", () => {
    const listing: NormalizedEvent = {
      source: "api:downtownfresno",
      sourceEventId: "https://www.downtownfresno.org/do/miss-california-competition-2026",
      title: "Miss California Competition 2026",
      venueName: "Saroyan Theatre",
      startTs: "2026-06-20T12:00:00.000Z",
      category: "community"
    };
    const html = `
      <h2 class="on-detail">Location</h2>
      <div class="awesome-box"><div class="awesome-box-link"><p>The Miss California pageant takes place at the Saroyan. The Golden State Gala and Mr. California pageant takes place at the DoubleTree.</p></div></div>`;
    const merged = parseDowntownDetailHtml(html, listing);
    expect(merged.venueName).toBe("Saroyan Theatre");
  });

  it("resolveDowntownDetailImage reads carousel hero when og:image is missing", () => {
    const html = `
      <div class="carousel-item active">
        <img class="d-block img-fluid" src="https://img.ctykit.com/cdn/ca-fresno/images/tr:w-1800/user1781041124.png" alt="" />
      </div>`;
    const $ = load(html);
    expect(resolveDowntownDetailImage($)).toBe(
      "https://img.ctykit.com/cdn/ca-fresno/images/tr:w-1800/user1781041124.png"
    );
  });

  it("parseDowntownDetailHtml attaches carousel image to listing rows", () => {
    const listing: NormalizedEvent = {
      source: "api:downtownfresno",
      sourceEventId: "https://www.downtownfresno.org/do/sonido-sunday",
      title: "Sonido Sunday",
      venueName: "Mundo Pol",
      startTs: "2026-06-14T17:00:00.000Z",
      category: "community"
    };
    const html = `
      <div class="carousel-item active">
        <img src="https://img.ctykit.com/cdn/ca-fresno/images/tr:w-1800/user1781041124.png" alt="" />
      </div>`;
    const merged = parseDowntownDetailHtml(html, listing);
    expect(merged.imageUrl).toBe("https://img.ctykit.com/cdn/ca-fresno/images/tr:w-1800/user1781041124.png");
  });

  it("parseDowntownDetailDescription prefers the Details paragraph over site meta", () => {
    const html = `
      <meta property="og:description" content="Los Lobos and Los Lonely Boys - The Brotherhood Tour | Downtown Fresno" />
      <h2 class="on-detail">Details</h2>
      <p>Los Lobos and Los Lonely Boys are teaming up for "The Brotherhood Tour" at the Warnors Theatre in Fresno on Sunday, August 2, 2026.</p>`;
    const $ = load(html);
    expect(parseDowntownDetailDescription($, "Los Lobos and Los Lonely Boys - The Brotherhood Tour")).toBe(
      'Los Lobos and Los Lonely Boys are teaming up for "The Brotherhood Tour" at the Warnors Theatre in Fresno on Sunday, August 2, 2026.'
    );
  });

  it("parseDowntownDetailDescription joins multiple Details paragraphs", () => {
    const html = `
      <h2 class="on-detail">Details</h2>
      <p>Join Fresno Ideaworks for Makerfest on Broadway, a community fundraiser celebrating art and making.</p>
      <p>This year's fundraiser supports critical roof repairs and preservation efforts following recent winter storm damage.</p>`;
    const $ = load(html);
    expect(parseDowntownDetailDescription($, "Makerfest on Broadway Presented by Fresno Ideaworks")).toBe(
      "Join Fresno Ideaworks for Makerfest on Broadway, a community fundraiser celebrating art and making.\n\nThis year's fundraiser supports critical roof repairs and preservation efforts following recent winter storm damage."
    );
  });

  it("parseDowntownDetailDescription includes participating businesses and FAQ sections", () => {
    const html = `
      <h2 class="on-detail">Details</h2>
      <p>Participating bars and restaurants in Downtown Fresno want you to feel welcome.</p>
      <ul><li>Free trolley rides around the route starting at 6pm.</li></ul>
      <h3>Mezcal Lounge Official Afterparty</h3>
      <p>1310 Van Ness Ave | 9PM - 2AM</p>
      <h2><strong>Participating Businesses</strong></h2>
      <ul><li>Mezcal Lounge</li><li>Procreations</li></ul>
      <h2>Ride the FresnoHop Crawly Trolley starting at 6pm for FREE!</h2>
      <p>Thanks to Fresno HOP, the Trolley will follow the map of the crawl until midnight.</p>
      <p><strong>FAQ</strong></p>
      <ul><li>Event is 21+ only</li></ul>
      <p>Subscribe to Our Newsletter</p>`;
    const $ = load(html);
    const description = parseDowntownDetailDescription($, "Crawl Downtown Fresno: Pride Crawl");
    expect(description).toContain("Participating bars");
    expect(description).toContain("Mezcal Lounge Official Afterparty");
    expect(description).toContain("Participating Businesses");
    expect(description).toContain("• Mezcal Lounge");
    expect(description).toContain("Ride the FresnoHop Crawly Trolley");
    expect(description).toContain("• Event is 21+ only");
    expect(description).not.toContain("Subscribe to Our Newsletter");
  });

  it("parseDowntownDetailHtml uses the Details paragraph for descriptionText", () => {
    const listing: NormalizedEvent = {
      source: "api:downtownfresno",
      sourceEventId: "https://www.downtownfresno.org/do/los-lobos-and-los-lonely-boys-the-brotherhood-tour",
      title: "Los Lobos and Los Lonely Boys - The Brotherhood Tour",
      venueName: "Warnors Center for the Performing Arts",
      startTs: "2026-08-02T12:00:00.000Z",
      category: "community"
    };
    const html = `
      <meta name="description" content="Los Lobos and Los Lonely Boys - The Brotherhood Tour | Downtown Fresno" />
      <h2 class="on-detail">Location</h2>
      <div class="awesome-box"><div class="awesome-box-link"><p><a href="/go/warnors">Warnors Center for the Performing Arts</a><br />1412 Fulton St</p></div></div>
      <h2 class="on-detail">Details</h2>
      <p>Los Lobos and Los Lonely Boys are teaming up for "The Brotherhood Tour" at the Warnors Theatre in Fresno on Sunday, August 2, 2026.</p>`;
    const merged = parseDowntownDetailHtml(html, listing);
    expect(merged.descriptionText).toBe(
      'Los Lobos and Los Lonely Boys are teaming up for "The Brotherhood Tour" at the Warnors Theatre in Fresno on Sunday, August 2, 2026.'
    );
    expect(merged.venueAddress).toBe("1412 Fulton St");
  });

  it("parseDowntownDetailTicketUrl reads visit-website pill link", () => {
    const html = `
      <p><a href="https://eventschaser.com/tickets/Los-Lobos-&amp;-Los-Lonely-Boys-Warnors-Theater-Fresno-CA/7864018/" class="btn btn-brand-pill" rel="noopener" target="_blank">visit website</a></p>`;
    const $ = load(html);
    expect(parseDowntownDetailTicketUrl($)).toBe(
      "https://eventschaser.com/tickets/Los-Lobos-&-Los-Lonely-Boys-Warnors-Theater-Fresno-CA/7864018/"
    );
  });

  it("parseDowntownDetailHtml attaches ticketUrl from visit-website button", () => {
    const listing: NormalizedEvent = {
      source: "api:downtownfresno",
      sourceEventId: "https://www.downtownfresno.org/do/los-lobos-and-los-lonely-boys-the-brotherhood-tour",
      title: "Los Lobos and Los Lonely Boys - The Brotherhood Tour",
      venueName: "Warnors Center for the Performing Arts",
      startTs: "2026-08-02T12:00:00.000Z",
      category: "community"
    };
    const html = `
      <p><a href="https://eventschaser.com/tickets/Los-Lobos-&amp;-Los-Lonely-Boys-Warnors-Theater-Fresno-CA/7864018/" class="btn btn-brand-pill" target="_blank">visit website</a></p>
      <h2 class="on-detail">Location</h2>
      <div class="awesome-box"><div class="awesome-box-link"><p><a href="/go/warnors">Warnors Center for the Performing Arts</a><br />1412 Fulton St</p></div></div>`;
    const merged = parseDowntownDetailHtml(html, listing);
    expect(merged.ticketUrl).toBe(
      "https://eventschaser.com/tickets/Los-Lobos-&-Los-Lonely-Boys-Warnors-Theater-Fresno-CA/7864018/"
    );
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
