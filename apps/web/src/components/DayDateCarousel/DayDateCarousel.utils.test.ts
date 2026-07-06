import { describe, expect, it } from "vitest";

import { swipeDayDelta } from "./DayDateCarousel.utils";

describe("swipeDayDelta", () => {
  it("returns 0 below threshold", () => {
    expect(swipeDayDelta(100, 130)).toBe(0);
  });

  it("returns 1 for left swipe", () => {
    expect(swipeDayDelta(200, 100)).toBe(1);
  });

  it("returns -1 for right swipe", () => {
    expect(swipeDayDelta(100, 200)).toBe(-1);
  });
});
