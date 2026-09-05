import { describe, expect, it } from "vitest";

import {
  formatIngestExclusionNotes,
  getIngestExclusion,
  isGobulldogsAwayGame,
  isMilbAwayGame
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

  it("rejects professional certification courses", () => {
    expect(
      getIngestExclusion({ title: "CAPM Certification Weekend Classroom Training" })?.id
    ).toBe("professional-certification-training");
    expect(getIngestExclusion({ title: "Ethical Hacking(CEH) Course Weekend Classroom" })?.id).toBe(
      "professional-certification-training"
    );
  });

  it("rejects franchise scavenger hunts", () => {
    expect(getIngestExclusion({ title: "Fresno Scavenger Hunt: Fresno Art & Culture" })?.id).toBe(
      "franchise-scavenger-hunt"
    );
  });

  it("keeps local community scavenger hunts without franchise title pattern", () => {
    expect(getIngestExclusion({ title: "Downtown Scavenger Hunt Night" })).toBeNull();
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

  it("rejects Fresno Grizzlies away games", () => {
    expect(isMilbAwayGame({ source: "api:milb", title: "Fresno Grizzlies at Visalia Rawhide" })).toBe(true);
    expect(
      getIngestExclusion({ source: "api:milb", title: "Fresno Grizzlies at Visalia Rawhide" })?.id
    ).toBe("milb-away");
  });

  it("keeps Fresno Grizzlies home games", () => {
    expect(isMilbAwayGame({ source: "api:milb", title: "Fresno Grizzlies vs Ontario Tower Buzzers" })).toBe(false);
    expect(
      getIngestExclusion({ source: "api:milb", title: "Fresno Grizzlies vs Ontario Tower Buzzers" })
    ).toBeNull();
  });

  it("does not treat non-gobulldogs titles with 'at' as Fresno State away games", () => {
    expect(isGobulldogsAwayGame({ source: "api:milb", title: "Fresno Grizzlies at Visalia Rawhide" })).toBe(false);
  });
});
