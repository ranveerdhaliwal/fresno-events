import { describe, expect, it } from "vitest";

import { API_VENUE_KEYS } from "./api-venues";
import { allVenueConfigs, loadEnabledVenues } from "./registry";

describe("venues/registry", () => {
  it("has unique keys", () => {
    const keys = allVenueConfigs().map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("loads all enabled venue modules", () => {
    const enabled = loadEnabledVenues();
    expect(enabled.length).toBe(12);
    expect(enabled.map((v) => v.key)).toContain("tower-theatre");
    expect(enabled.map((v) => v.key)).toContain("gobulldogs");
    for (const apiKey of API_VENUE_KEYS) {
      expect(enabled.map((v) => v.key)).toContain(apiKey);
    }
  });

  it("filters by venue key", () => {
    const filtered = loadEnabledVenues(["tower-theatre"]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.key).toBe("tower-theatre");
  });
});
