import { describe, expect, it } from "vitest";

import {
  computeCanonicalSeriesId,
  isRecurringSeries,
  listingUrlSeriesAnchor,
  venueScope
} from "./series.js";

describe("isRecurringSeries", () => {
  it("detects Visit Fresno recurrence strings", () => {
    expect(isRecurringSeries({ seriesName: "Recurring weekly on Tuesday" })).toBe(true);
    expect(isRecurringSeries({ seriesName: "Recurring monthly on the 1st Tuesday" })).toBe(true);
  });

  it("rejects one-off events", () => {
    expect(isRecurringSeries({})).toBe(false);
    expect(isRecurringSeries({ seriesName: "Big Fresno Fair 2026" })).toBe(false);
  });
});

describe("venueScope", () => {
  it("strips api: prefix", () => {
    expect(venueScope("api:visitfresnocounty", "Backyard")).toBe("visitfresnocounty");
  });

  it("strips scrape: prefix and www.", () => {
    expect(venueScope("scrape:www.savemartcenter.com", "Save Mart")).toBe("savemartcenter.com");
  });
});

describe("listingUrlSeriesAnchor", () => {
  it("strips trailing numeric segment", () => {
    expect(
      listingUrlSeriesAnchor("https://www.visitfresnocounty.org/event/backyard-101-trivia/8487/")
    ).toBe("visitfresnocounty.org/event/backyard-101-trivia/");
  });

  it("returns null for empty/undefined", () => {
    expect(listingUrlSeriesAnchor(undefined)).toBeNull();
  });
});

describe("computeCanonicalSeriesId", () => {
  it("returns existing seriesId unchanged (explicit)", async () => {
    const result = await computeCanonicalSeriesId({
      source: "scrape:fair.com",
      title: "Fair",
      venueName: "Fairgrounds",
      seriesId: "series:bigfresnofair:2026",
      seriesName: "Festival"
    });
    expect(result.seriesId).toBe("series:bigfresnofair:2026");
  });

  it("skips when no recurrence signal", async () => {
    const result = await computeCanonicalSeriesId({
      source: "api:milb",
      title: "Grizzlies vs Rawhide",
      venueName: "Chukchansi Park"
    });
    expect(result.seriesId).toBeUndefined();
  });

  it("title drift produces same seriesId", async () => {
    const base = {
      source: "api:visitfresnocounty",
      venueName: "The Backyard Social Club",
      seriesName: "Recurring weekly on Tuesday"
    };
    const a = await computeCanonicalSeriesId({ ...base, title: "Backyard 101 - Trivia" });
    const b = await computeCanonicalSeriesId({ ...base, title: "Backyard101 - Trivia" });
    expect(a.seriesId).toBe(b.seriesId);
    expect(a.seriesId).toMatch(/^series:visitfresnocounty:[a-f0-9]{64}$/);
  });

  it("groups multi-night listings by shared recid", async () => {
    const base = {
      source: "api:visitfresnocounty",
      title: "Miss California Competition Week",
      venueName: "William Saroyan Theatre",
      seriesListingRecId: "9109",
      groupByListingRecId: true
    };
    const a = await computeCanonicalSeriesId(base);
    const b = await computeCanonicalSeriesId({ ...base, title: "Miss California Competition Week" });
    expect(a.seriesId).toBe(b.seriesId);
    expect(a.seriesId).toMatch(/^series:visitfresnocounty:[a-f0-9]{64}$/);
  });

  it("different CMS slugs same loose title → same seriesId", async () => {
    const base = {
      source: "api:visitfresnocounty",
      title: "Backyard 101 - Trivia",
      venueName: "The Backyard Social Club",
      seriesName: "Recurring weekly on Tuesday"
    };
    const slugA = await computeCanonicalSeriesId({
      ...base,
      externalUrl: "https://www.visitfresnocounty.org/event/backyard-101-trivia/8487/"
    });
    const slugB = await computeCanonicalSeriesId({
      ...base,
      title: "Backyard101 - Trivia",
      externalUrl: "https://www.visitfresnocounty.org/event/backyard101-trivia/6510/"
    });
    expect(slugA.seriesId).toBe(slugB.seriesId);
  });
});
