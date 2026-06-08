// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseBounds, parseRequireCoords } from "./events.utils";

describe("events.utils map parsing", () => {
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
