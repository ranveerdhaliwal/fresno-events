// @vitest-environment node
import { describe, expect, it } from "vitest";

import { getMockEventList } from "@/services/events.mock";

import {
  eventIsFree,
  formatDetailPrice,
  formatListPrice,
  LIST_TICKET_PRICE_LABEL
} from "./event-price.utils";

describe("event-price.utils", () => {
  const base = getMockEventList()[0]!.event;

  it("detects free from isFree or zero prices", () => {
    expect(eventIsFree({ ...base, isFree: true })).toBe(true);
    expect(eventIsFree({ ...base, isFree: false, priceMin: 0, priceMax: 0 })).toBe(true);
    expect(eventIsFree({ ...base, isFree: false, priceMin: 25, priceMax: 50 })).toBe(false);
  });

  it("formats list price as Free, dollars, or ticket hint", () => {
    expect(formatListPrice({ ...base, isFree: true, priceMin: 0, priceMax: 0 })).toBe("Free");
    expect(formatListPrice({ ...base, isFree: false, priceMin: 100, priceMax: 110 })).toBe("$100+");
    expect(formatDetailPrice({ ...base, isFree: false, priceMin: 100, priceMax: 110 })).toBe("$100-110");
    expect(formatListPrice({ ...base, isFree: false, priceMin: 77, priceMax: 77 })).toBe("$77");
    expect(formatDetailPrice({ ...base, isFree: false, priceMin: 77, priceMax: 77 })).toBe("$77");
    expect(formatListPrice({ ...base, isFree: false, priceMin: 40, priceMax: 40 })).toBe("$40");
    expect(formatDetailPrice({ ...base, isFree: false, priceMin: 40, priceMax: 40 })).toBe("$40");
    expect(formatListPrice({ ...base, isFree: false, priceMin: 40, priceMax: 55 })).toBe("$40+");
    const { priceMin: _min, priceMax: _max, isFree: _free, ...noPrice } = base;
    expect(
      formatListPrice({
        ...noPrice,
        isFree: false,
        ticketUrl: "https://tickets.example.com/show"
      })
    ).toBe(LIST_TICKET_PRICE_LABEL);
    expect(formatListPrice({ ...noPrice, isFree: false })).toBe("");
  });

  it("formats detail price with notes or ticket fallback", () => {
    const { priceMin: _min, priceMax: _max, isFree: _free, ...noPrice } = base;
    expect(
      formatDetailPrice({
        ...noPrice,
        isFree: false,
        ticketUrl: "https://tickets.example.com/show"
      })
    ).toBe("See tickets for price");
    expect(
      formatDetailPrice({
        ...noPrice,
        isFree: false,
        priceNotes: "Donations welcome"
      })
    ).toBe("Donations welcome");
  });
});
