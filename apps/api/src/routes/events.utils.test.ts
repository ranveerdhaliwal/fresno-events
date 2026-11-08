// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseBounds, parseRequireCoords, parseSeriesCursor } from "./events.utils";

describe("events.utils map parsing", () => {
  it("accepts bounded series offsets and rejects malformed cursors", () => {
    expect(parseSeriesCursor(undefined)).toBe(0);
    expect(parseSeriesCursor("50")).toBe(50);
    for (const value of ["", "-1", "1.5", "1e3", "NaN", "1000001"]) {
      expect(parseSeriesCursor(value)).toBeNull();
    }
  });
  it("parses valid bounds", () => {
    expect(parseBounds("36.6,-120.6,37.1,-119.3")).toEqual({
      swLat: 36.6,
      swLng: -120.6,
      neLat: 37.1,
      neLng: -119.3
    });
  });

  it("rejects invalid bounds", () => {
    expect(parseBounds("bad")).toBeNull();
  });

  it("parses require_coords flag", () => {
    expect(parseRequireCoords("true")).toBe(true);
    expect(parseRequireCoords("0")).toBe(false);
  });
});
