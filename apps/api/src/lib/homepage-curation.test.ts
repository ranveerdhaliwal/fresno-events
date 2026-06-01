// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  homepageListFrom,
  isEventEligibleForHomepage,
  isSlotStale
} from "@/lib/homepage-curation";

describe("homepage-curation utils", () => {
  const now = new Date("2026-05-31T20:00:00.000Z");

  it("treats events within grace window as eligible", () => {
    const from = homepageListFrom(now);
    expect(
      isEventEligibleForHomepage(
        { startTs: new Date(from.getTime() + 60_000).toISOString(), status: "scheduled" },
        now
      )
    ).toBe(true);
  });

  it("marks stale when event is before grace window", () => {
    expect(
      isSlotStale({ startTs: "2026-05-30T00:00:00.000Z", status: "scheduled" }, now)
    ).toBe(true);
  });

  it("marks stale when status is cancelled", () => {
    expect(
      isSlotStale({ startTs: "2026-06-01T00:00:00.000Z", status: "cancelled" }, now)
    ).toBe(true);
  });
});
