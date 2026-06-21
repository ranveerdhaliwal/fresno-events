import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import {
  applyFresnoFairPricePolicy,
  isFresnoFairFreeAdmissionListing,
  parseFresnoFairFreeAdmissionFromHtml
} from "./fresno-fair-price.utils";

const fleaMarket: NormalizedEvent = {
  source: "scrape:www.fresnofair.com",
  sourceEventId: "venue:big-fresno-fair:411:2026-10-16",
  title: "Fresno Flea Market",
  venueName: "Big Fresno Fair",
  venueCity: "Fresno",
  startTs: "2026-10-16T13:00:00.000Z"
};

describe("fresno-fair-price.utils", () => {
  it("detects flea market by fair EventID and title", () => {
    expect(isFresnoFairFreeAdmissionListing(fleaMarket)).toBe(true);
    expect(
      isFresnoFairFreeAdmissionListing({
        ...fleaMarket,
        sourceEventId: "venue:big-fresno-fair:999:2026-10-16",
        title: "Fresno Flea Market"
      })
    ).toBe(true);
    expect(
      isFresnoFairFreeAdmissionListing({
        ...fleaMarket,
        sourceEventId: "venue:big-fresno-fair:3714:2026-10-07",
        title: "Kansas With Starship"
      })
    ).toBe(false);
  });

  it("marks flea market listings as free admission", () => {
    const priced = { ...fleaMarket, priceMin: 15, priceNotes: "Parking $3" };
    expect(applyFresnoFairPricePolicy(priced)).toEqual({
      ...fleaMarket,
      isFree: true,
      priceMin: 0,
      priceMax: 0
    });
  });

  it("parses free admission copy from fair detail HTML", () => {
    const html = `<div>Admission is always <strong>FREE</strong>!</div>`;
    expect(parseFresnoFairFreeAdmissionFromHtml(html)).toBe(true);
  });
});
