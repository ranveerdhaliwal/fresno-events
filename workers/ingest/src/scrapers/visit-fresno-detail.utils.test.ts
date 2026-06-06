import { describe, expect, it } from "vitest";

import {
  finalizeVisitFresnoDetailMerge,
  mergeVisitFresnoDetail,
  parseVisitFresnoDetailPage,
  parseVisitFresnoPriceText,
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
});
