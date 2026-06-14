import { describe, expect, it } from "vitest";

import { buildDayWindowTiles, dayWindowStart, daysBetweenIso } from "./day-window.utils";

describe("dayWindowStart", () => {
  it("centers selected date in a 7-slot row", () => {
    expect(dayWindowStart("2026-06-04", 7)).toBe("2026-06-01");
  });
});

describe("daysBetweenIso", () => {
  it("measures signed day distance", () => {
    expect(daysBetweenIso("2026-05-14", "2026-05-22")).toBe(8);
    expect(daysBetweenIso("2026-05-22", "2026-05-14")).toBe(-8);
  });
});

describe("buildDayWindowTiles", () => {
  it("returns consecutive days from the window start", () => {
    const counts = new Map([["2026-06-02", 3]]);
    const tiles = buildDayWindowTiles("2026-06-01", 3, counts, "2026-06-01");
    expect(tiles.map((t) => t.isoDate)).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);
    expect(tiles[1]?.count).toBe(3);
    expect(tiles[0]?.isToday).toBe(true);
  });
});
