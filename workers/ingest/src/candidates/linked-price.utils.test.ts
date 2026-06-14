import { describe, expect, it } from "vitest";

import {
  buildLinkedPricePatches,
  hasUsablePrice,
  mergeInheritedPrice,
  type LinkedPriceMember
} from "@/candidates/linked-price.utils";

function member(
  patch: Partial<LinkedPriceMember> & Pick<LinkedPriceMember, "id" | "normalized_event">
): LinkedPriceMember {
  return {
    source: "ticketmaster",
    canonical_candidate_id: null,
    ...patch
  };
}

describe("linked-price.utils", () => {
  it("hasUsablePrice detects min/max, notes, and free", () => {
    expect(hasUsablePrice({ source: "ticketmaster", sourceEventId: "1", title: "T", venueName: "V", startTs: "2026-01-01T12:00:00Z" })).toBe(false);
    expect(
      hasUsablePrice({
        source: "ticketmaster",
        sourceEventId: "1",
        title: "T",
        venueName: "V",
        startTs: "2026-01-01T12:00:00Z",
        priceMin: 25
      })
    ).toBe(true);
    expect(
      hasUsablePrice({
        source: "ticketmaster",
        sourceEventId: "1",
        title: "T",
        venueName: "V",
        startTs: "2026-01-01T12:00:00Z",
        isFree: true
      })
    ).toBe(true);
  });

  it("buildLinkedPricePatches copies fair prices onto ticketmaster siblings", () => {
    const fairEvent = {
      source: "scrape:www.fresnofair.com" as const,
      sourceEventId: "fair-1",
      title: "Russell Dickerson",
      venueName: "Fresno Fair",
      startTs: "2026-07-01T02:00:00Z",
      priceMin: 45,
      priceMax: 65
    };
    const tmEvent = {
      source: "ticketmaster" as const,
      sourceEventId: "tm-1",
      title: "Russell Dickerson",
      venueName: "Fresno Fair",
      startTs: "2026-07-01T02:00:00Z"
    };

    const patches = buildLinkedPricePatches([
      member({ id: "tm", normalized_event: tmEvent }),
      member({
        id: "fair",
        source: "scrape:www.fresnofair.com",
        canonical_candidate_id: "tm",
        normalized_event: fairEvent
      })
    ]);

    expect(patches).toHaveLength(1);
    expect(patches[0]?.id).toBe("tm");
    expect(patches[0]?.normalized_event.priceMin).toBe(45);
    expect(patches[0]?.normalized_event.priceMax).toBe(65);
    expect(patches[0]?.fromSource).toBe("scrape:www.fresnofair.com");
  });

  it("mergeInheritedPrice leaves rows that already have a price unchanged", () => {
    const target = {
      source: "ticketmaster" as const,
      sourceEventId: "tm",
      title: "Show",
      venueName: "Venue",
      startTs: "2026-01-01T12:00:00Z",
      priceMin: 30
    };
    const source = {
      source: "scrape:www.fresnofair.com" as const,
      sourceEventId: "fair",
      title: "Show",
      venueName: "Venue",
      startTs: "2026-01-01T12:00:00Z",
      priceMin: 45,
      priceMax: 65
    };

    expect(mergeInheritedPrice(target, source)).toBeNull();
  });
});
