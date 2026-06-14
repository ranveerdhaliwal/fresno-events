import { describe, expect, it } from "vitest";

import {
  finalizeVisitFresnoDetailMerge,
  formatVisitFresnoDescriptionHtml,
  mergeVisitFresnoDetail,
  parseVisitFresnoDetailPage,
  parseVisitFresnoPriceText,
  parseVisitFresnoTimeRangeText,
  VISIT_FRESNO_PRICE_NOT_LISTED
} from "./visit-fresno-detail.utils.js";

const SAMPLE_HTML = `
<html><body>
<h1>Miss California Competition Week</h1>
<ul>
  <li data-name="address"><span class="info-list-label">Address:</span><span class="info-list-value">730 M Street, Fresno, CA 93721</span></li>
  <li data-name="location"><span class="info-list-label">Location:</span><span class="info-list-value">William Saroyan Theatre</span></li>
  <li data-name="price"><span class="info-list-label">Price:</span><span class="info-list-value">see website for details</span></li>
</ul>
<h2>Description</h2>
<p>Join us for an unforgettable week of competition.</p>
</body></html>
`;

const FASHION_FAIR_DESCRIPTION_HTML =
  "<p>Bring the whole family to the Outdoor Village from 6-8pm on Fridays in July and August to enjoy games, crafts, and interactive fun like giant bubbles, face painting, balloon animals, and more!</p>\r\n<p>Interactive events vary from week to week.  Weekly games of Giant Checkers, Giant Connect Four, Giant Jenga, and Cornhole available weekly.  See below for full schedule. </p>\r\n<ul>\r\n<li>July 5th - Face Painting &amp; Balloon Art</li>\r\n<li>July 12th - Giant Bubbles</li>\r\n<li>July 19th - Giant Bubbles</li>\r\n<li>July 26th - Face Painting &amp; Balloon Art</li>\r\n<li>August 2nd - TBD</li>\r\n<li>August 9th - Face Painting &amp; Balloon Art</li>\r\n<li>August 16th - TBD</li>\r\n</ul>";

const FASHION_FAIR_DETAIL_HTML = `
<html><body>
<h1>Fashion Fair Family Fridays</h1>
<ul>
  <li data-name="time"><span class="info-list-value">6:00 PM to 8:00 PM</span></li>
  <li data-name="location"><span class="info-list-value">Fashion Fair Mall</span></li>
  <li data-name="price"><span class="info-list-value">Free</span></li>
</ul>
<h2>Description</h2>
${FASHION_FAIR_DESCRIPTION_HTML}
<h2>Map</h2>
</body></html>
`;

const OLD_TOWN_CLOVIS_DESCRIPTION_HTML =
  "<p>Check out the Old Town Clovis Saturday Farmers Market from 9am - 11:30am. This small market has everything you need for your local, seasonal shopping: G.T. Florists &amp; Herbs have a large assortment of vegetables, fruits, herbs and flowers; Ferrer Farms has seasonal, local grown fruits and veggies.</p>";

describe("formatVisitFresnoDescriptionHtml", () => {
  it("preserves paragraphs and list lines for recurring Fashion Fair Fridays", () => {
    const formatted = formatVisitFresnoDescriptionHtml(FASHION_FAIR_DESCRIPTION_HTML);
    expect(formatted).toBe(
      [
        "Bring the whole family to the Outdoor Village from 6-8pm on Fridays in July and August to enjoy games, crafts, and interactive fun like giant bubbles, face painting, balloon animals, and more!",
        "Interactive events vary from week to week. Weekly games of Giant Checkers, Giant Connect Four, Giant Jenga, and Cornhole available weekly. See below for full schedule.",
        [
          "July 5th - Face Painting & Balloon Art",
          "July 12th - Giant Bubbles",
          "July 19th - Giant Bubbles",
          "July 26th - Face Painting & Balloon Art",
          "August 2nd - TBD",
          "August 9th - Face Painting & Balloon Art",
          "August 16th - TBD"
        ].join("\n")
      ].join("\n\n")
    );
  });

  it("decodes HTML entities such as &amp;", () => {
    const formatted = formatVisitFresnoDescriptionHtml(OLD_TOWN_CLOVIS_DESCRIPTION_HTML);
    expect(formatted).toContain("G.T. Florists & Herbs");
    expect(formatted).not.toContain("&amp;");
  });
});

describe("parseVisitFresnoPriceText", () => {
  it("parses Free", () => {
    expect(parseVisitFresnoPriceText("Free")).toEqual({ isFree: true, currency: "USD" });
  });

  it("parses dollar amounts", () => {
    expect(parseVisitFresnoPriceText("$15 - $25")).toEqual({
      priceMin: 15,
      priceMax: 25,
      currency: "USD"
    });
  });

  it("keeps prose as priceNotes", () => {
    expect(parseVisitFresnoPriceText("see website for details")).toEqual({
      priceNotes: "see website for details"
    });
  });
});

const NO_PRICE_HTML = `
<html><body>
<h1>The Cobra Comedy Open Mic</h1>
<ul>
  <li data-name="address"><span class="info-list-value">123 Main St, Fresno, CA</span></li>
  <li data-name="location"><span class="info-list-value">The Cobra</span></li>
</ul>
<h2>Description</h2>
<p>Open mic night every week.</p>
</body></html>
`;

describe("parseVisitFresnoTimeRangeText", () => {
  it("parses Simpleview time ranges", () => {
    expect(parseVisitFresnoTimeRangeText("9:00 AM to 11:30 AM")).toEqual({
      startClock: "09:00",
      endClock: "11:30"
    });
  });
});

const FARMERS_MARKET_HTML = `
<html><body>
<h1>Old Town Clovis Farmers Market</h1>
<ul>
  <li data-name="time"><span class="info-list-value">9:00 AM to 11:30 AM</span></li>
  <li data-name="location"><span class="info-list-value">Old Town Clovis</span></li>
</ul>
<h2>Description</h2>
<p>Saturday market.</p>
</body></html>
`;

describe("parseVisitFresnoDetailPage", () => {
  it("extracts info-list fields and description", () => {
    const parsed = parseVisitFresnoDetailPage(SAMPLE_HTML);
    expect(parsed?.venueAddress).toBe("730 M Street, Fresno, CA 93721");
    expect(parsed?.venueName).toBe("William Saroyan Theatre");
    expect(parsed?.priceNotes).toBe("see website for details");
    expect(parsed?.descriptionText).toContain("unforgettable week");
  });

  it("parses pages without a price field", () => {
    const parsed = parseVisitFresnoDetailPage(NO_PRICE_HTML);
    expect(parsed?.venueName).toBe("The Cobra");
    expect(parsed?.priceNotes).toBeUndefined();
    expect(parsed?.isFree).toBeUndefined();
  });

  it("extracts time ranges from the info list", () => {
    const parsed = parseVisitFresnoDetailPage(FARMERS_MARKET_HTML);
    expect(parsed?.timeRange).toEqual({ startClock: "09:00", endClock: "11:30" });
  });

  it("formats multi-paragraph descriptions with schedule lists", () => {
    const parsed = parseVisitFresnoDetailPage(FASHION_FAIR_DETAIL_HTML);
    expect(parsed?.descriptionText).toContain("Face Painting & Balloon Art");
    expect(parsed?.descriptionText).not.toContain("&amp;");
    expect(parsed?.descriptionText?.split("\n")).toContain("July 12th - Giant Bubbles");
    expect(parsed?.descriptionText?.split("\n\n").length).toBeGreaterThanOrEqual(3);
  });
});

describe("finalizeVisitFresnoDetailMerge", () => {
  it("sets priceNotes when detail page has no price", () => {
    const listing = {
      source: "api:visitfresnocounty" as const,
      sourceEventId: "occ-cobra",
      title: "The Cobra Comedy Open Mic",
      venueName: "The Cobra",
      startTs: "2026-06-03T02:00:00.000Z",
      descriptionText: "Open mic"
    };
    const parsed = parseVisitFresnoDetailPage(NO_PRICE_HTML);
    expect(parsed).not.toBeNull();
    const merged = finalizeVisitFresnoDetailMerge(listing, parsed!);
    expect(merged.priceNotes).toBe(VISIT_FRESNO_PRICE_NOT_LISTED);
  });
});

describe("mergeVisitFresnoDetail", () => {
  it("adds price fields without changing startTs", () => {
    const listing = {
      source: "api:visitfresnocounty" as const,
      sourceEventId: "abc",
      title: "Miss California Competition Week",
      venueName: "William Saroyan Theatre",
      startTs: "2026-06-20T02:00:00.000Z",
      descriptionText: "Short"
    };
    const merged = mergeVisitFresnoDetail(listing, { priceNotes: "see website for details" });
    expect(merged.priceNotes).toBe("see website for details");
    expect(merged.startTs).toBe(listing.startTs);
  });

  it("overrides API times with detail-page time ranges", () => {
    const listing = {
      source: "api:visitfresnocounty" as const,
      sourceEventId: "3850:2026-06-27",
      title: "Old Town Clovis Farmers Market",
      venueName: "Old Town Clovis",
      startTs: "2026-06-27T16:00:00.000Z",
      endTs: "2026-06-27T18:00:00.000Z",
      timeUnknown: false
    };
    const parsed = parseVisitFresnoDetailPage(FARMERS_MARKET_HTML);
    expect(parsed).not.toBeNull();
    const merged = mergeVisitFresnoDetail(listing, parsed!);
    const endParts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      timeZone: "America/Los_Angeles"
    }).formatToParts(new Date(merged.endTs!));
    const endHour = Number(endParts.find((p) => p.type === "hour")?.value);
    const endMinute = Number(endParts.find((p) => p.type === "minute")?.value);
    expect(endHour).toBe(11);
    expect(endMinute).toBe(30);
  });
});
