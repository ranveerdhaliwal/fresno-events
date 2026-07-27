import { describe, expect, it } from "vitest";

import {
  formatIngestExclusionNotes,
  getIngestExclusion,
  isGobulldogsAwayGame
} from "./ingest-exclusions.js";

describe("ingest-exclusions", () => {
  it("rejects Shen Yun by title", () => {
    const result = getIngestExclusion({ title: "Shen Yun" });
    expect(result?.id).toBe("shen-yun");
    expect(formatIngestExclusionNotes(result!)).toContain("excluded");
  });

  it("rejects Shen Yun when mentioned in description", () => {
    expect(getIngestExclusion({ title: "Evening Performance", descriptionText: "Presented by Shen Yun" })?.id).toBe(
      "shen-yun"
    );
  });

  it("allows unrelated events", () => {
    expect(getIngestExclusion({ title: "Mrs. Doubtfire" })).toBeNull();
  });

  it("rejects Fresno State away games by title pattern", () => {
    expect(
      getIngestExclusion({
        source: "api:gobulldogs",
        title: "Football at San Diego State"
      })?.id
    ).toBe("gobulldogs-away");
    expect(
      getIngestExclusion({
        source: "api:gobulldogs",
        title: "Cross Country at Gaucho Twilight"
      })?.id
    ).toBe("gobulldogs-away");
  });

  it("keeps Fresno State home and invitational games", () => {
    expect(
      getIngestExclusion({
        source: "api:gobulldogs",
        title: "Women's Soccer vs Oregon State"
      })
    ).toBeNull();
    expect(
      getIngestExclusion({
        source: "api:gobulldogs",
        title: "Women's Volleyball: UC Irvine vs. New Mexico State"
      })
    ).toBeNull();
  });

  it("does not treat non-gobulldogs titles with 'at' as away games", () => {
    expect(isGobulldogsAwayGame({ source: "api:milb", title: "Fresno Grizzlies at Visalia Rawhide" })).toBe(false);
    expect(getIngestExclusion({ source: "api:milb", title: "Fresno Grizzlies at Visalia Rawhide" })).toBeNull();
  });
});
