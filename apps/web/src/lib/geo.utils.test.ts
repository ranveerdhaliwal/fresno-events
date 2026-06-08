// @vitest-environment node
import { describe, expect, it } from "vitest";

import { haversineKm, withinRadius } from "./geo.utils";

describe("geo.utils", () => {
  it("computes zero distance for identical points", () => {
    expect(haversineKm(36.7, -119.8, 36.7, -119.8)).toBe(0);
  });

  it("detects points within radius", () => {
    expect(withinRadius(36.7378, -119.7871, 36.7378, -119.7871, 1)).toBe(true);
    expect(withinRadius(36.7378, -119.7871, 37.5, -119.7871, 10)).toBe(false);
  });
});
