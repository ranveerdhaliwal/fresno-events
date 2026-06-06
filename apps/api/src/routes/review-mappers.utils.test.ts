import { describe, expect, it } from "vitest";

import { buildEventSlug } from "@/routes/review-mappers.utils";

const FASHION_FAIR_TITLE =
  "Fashion Fair Mall Free Kids Club, hosted by Miss Mia | Presented by Central California Parent";

describe("buildEventSlug", () => {
  it("appends the occurrence date so recurring titles get distinct slugs", () => {
    const june = buildEventSlug(FASHION_FAIR_TITLE, "2026-06-06T18:30:00.000Z");
    const july = buildEventSlug(FASHION_FAIR_TITLE, "2026-07-04T18:30:00.000Z");

    expect(june).not.toBe(july);
    expect(june.endsWith("-2026-06-06")).toBe(true);
    expect(july.endsWith("-2026-07-04")).toBe(true);
    expect(june.length).toBeLessThanOrEqual(80);
    expect(july.length).toBeLessThanOrEqual(80);
  });

  it("keeps the date suffix when the title slug is truncated", () => {
    const slug = buildEventSlug(FASHION_FAIR_TITLE, "2026-08-01T18:30:00.000Z");

    expect(slug.endsWith("-2026-08-01")).toBe(true);
    expect(slug.length).toBe(80);
    expect(slug).toMatch(/^fashion-fair-mall/);
    expect(slug).toMatch(/parent-2026-08-01$/);
  });
});
