import { describe, expect, it } from "vitest";

import {
  formatTitleSimilarityLabel,
  isNearCrossSourceTitleMatch,
  isStrongCrossSourceTitleMatch,
  scoreTitleSimilarity,
  significantTitleTokens
} from "./title-similarity.utils.js";

describe("title similarity", () => {
  it("scores Lil Wayne Ticketmaster vs Venunite as a strong match", () => {
    const score = scoreTitleSimilarity(
      "LIL WAYNE: 20 YEARS OF CARTER CLASSICS WITH THE GAME",
      "Lil Wayne Live in Fresno - 20 Years of Carter Classics Tour"
    );

    expect(score.sharedCount).toBeGreaterThanOrEqual(5);
    expect(isStrongCrossSourceTitleMatch(score)).toBe(true);
    expect(isNearCrossSourceTitleMatch(score)).toBe(true);
    expect(formatTitleSimilarityLabel(score)).toMatch(/shared words/);
  });

  it("keeps unrelated same-venue shows below auto-link threshold", () => {
    const score = scoreTitleSimilarity("Jazz Night Trio", "Comedy Open Mic Night");

    expect(isStrongCrossSourceTitleMatch(score)).toBe(false);
    expect(isNearCrossSourceTitleMatch(score)).toBe(false);
  });

  it("flags partial overlap for admin near-match hints", () => {
    const score = scoreTitleSimilarity(
      "George Lopez Live",
      "George Lopez: The Wall Live"
    );

    expect(score.sharedCount).toBeGreaterThanOrEqual(2);
    expect(isNearCrossSourceTitleMatch(score)).toBe(true);
  });

  it("strips tour and city noise from significant tokens", () => {
    const tokens = significantTitleTokens("Lil Wayne Live in Fresno - 20 Years Tour");
    expect(tokens).toContain("lil");
    expect(tokens).toContain("wayne");
    expect(tokens).not.toContain("fresno");
    expect(tokens).not.toContain("tour");
  });
});
