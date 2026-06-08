import { describe, expect, it } from "vitest";

import { buildEventSlug } from "@/routes/review-mappers.utils";

const FASHION_FAIR_TITLE =
  "Fashion Fair Mall Free Kids Club, hosted by Miss Mia | Presented by Central California Parent";

describe("buildEventSlug", () => {
  it("appends the occurrence date so recurring titles get distinct slugs", () => {
    const june = buildEventSlug(FASHION_FAIR_TITLE, "2026-06-06T18:30:00.000Z");
    const july = buildEventSlug(FASHION_FAIR_TITLE, "2026-07-04T18:30:00.000Z");

    expect(june).not.toBe(july);
    expect(june.endsWith("-2026-06-06-1130")).toBe(true);
    expect(july.endsWith("-2026-07-04-1130")).toBe(true);
    expect(june.length).toBeLessThanOrEqual(80);
    expect(july.length).toBeLessThanOrEqual(80);
  });

  it("keeps the date suffix when the title slug is truncated", () => {
    const slug = buildEventSlug(FASHION_FAIR_TITLE, "2026-08-01T18:30:00.000Z");

    expect(slug.endsWith("-2026-08-01-1130")).toBe(true);
    expect(slug.length).toBe(80);
    expect(slug).toMatch(/^fashion-fair-mall/);
    expect(slug).toMatch(/parent-2026-08-01-1130$/);
  });

  it("uses Pacific show night so multi-night titles on adjacent evenings get distinct slugs", () => {
    const teenTitle = "Miss California's Teen 2026";
    const june18 = buildEventSlug(teenTitle, "2026-06-19T02:00:00.000Z");
    const june19 = buildEventSlug(teenTitle, "2026-06-19T23:00:00.000Z");

    expect(june18.endsWith("-2026-06-18-1900")).toBe(true);
    expect(june19.endsWith("-2026-06-19-1600")).toBe(true);
    expect(june18).not.toBe(june19);
  });

  it("uses Pacific show time so same-day matinee and evening get distinct slugs", () => {
    const title = "Ringling Bros. And Barnum & Bailey Presents The Greatest Show On Earth";
    const matinee = buildEventSlug(title, "2026-07-05T20:00:00.000Z");
    const evening = buildEventSlug(title, "2026-07-06T00:00:00.000Z");

    expect(matinee.endsWith("-2026-07-05-1300")).toBe(true);
    expect(evening.endsWith("-2026-07-05-1700")).toBe(true);
    expect(matinee).not.toBe(evening);
  });
});
