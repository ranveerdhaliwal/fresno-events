// @vitest-environment node
import { describe, expect, it } from "vitest";

import { getMockEventList } from "@/services/events.mock";

import { deriveTagline, formatPrice, toEventRowViewModel, toPopularViewModels } from "./event-view-model";

describe("event-view-model", () => {
  const first = getMockEventList()[0]!;

  it("formats free price", () => {
    expect(formatPrice({ ...first.event, isFree: true, priceMin: 0, priceMax: 0 })).toBe("Free");
  });

  it("returns empty string when price is unknown", () => {
    const { priceMin: _min, priceMax: _max, isFree: _free, ...rest } = first.event;
    expect(formatPrice({ ...rest, isFree: false })).toBe("");
  });

  it("shows ticket hint on list when price unknown but ticket URL exists", () => {
    const { priceMin: _min, priceMax: _max, isFree: _free, ...rest } = first.event;
    expect(
      formatPrice({
        ...rest,
        isFree: false,
        ticketUrl: "https://tickets.example.com/show"
      })
    ).toBe("See Tickets for price");
  });

  it("derives tagline from description", () => {
    const tagline = deriveTagline(first.event);
    expect(tagline.length).toBeGreaterThan(0);
    expect(tagline.length).toBeLessThanOrEqual(80);
  });

  it("maps row view model with priority", () => {
    const row = toEventRowViewModel(first);
    expect(row.slug).toBe(first.event.slug);
    expect(row.priority).toBe(first.event.priority);
    expect(row.priceLabel).toBeTruthy();
  });

  it("ranks popular events by priority", () => {
    const popular = toPopularViewModels(getMockEventList());
    expect(popular[0]?.rank).toBe(1);
    expect(popular.length).toBeLessThanOrEqual(5);
  });
});
