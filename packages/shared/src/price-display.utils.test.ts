import { describe, expect, it } from "vitest";

import { applyDisplayPriceRounding, roundDisplayPriceUp } from "./price-display.utils.js";

describe("roundDisplayPriceUp", () => {
  it("rounds fractional dollars up", () => {
    expect(roundDisplayPriceUp(31.83)).toBe(32);
    expect(roundDisplayPriceUp(34.92)).toBe(35);
    expect(roundDisplayPriceUp(12.51)).toBe(13);
    expect(roundDisplayPriceUp(15)).toBe(15);
  });

  it("returns 0 for non-positive values", () => {
    expect(roundDisplayPriceUp(0)).toBe(0);
    expect(roundDisplayPriceUp(-5)).toBe(0);
  });
});

describe("applyDisplayPriceRounding", () => {
  it("rounds min and max on ingest-shaped events", () => {
    expect(
      applyDisplayPriceRounding({
        priceMin: 31.83,
        priceMax: 34.92
      })
    ).toEqual({ priceMin: 32, priceMax: 35 });
  });

  it("skips free events", () => {
    expect(
      applyDisplayPriceRounding({
        isFree: true,
        priceMin: 0,
        priceMax: 0
      })
    ).toEqual({ isFree: true, priceMin: 0, priceMax: 0 });
  });
});
