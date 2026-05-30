import { describe, expect, it } from "vitest";

import {
  computeOccurrenceFingerprints,
  computeOccurrenceKey,
  computeUrlKey,
  normalizeTitle,
  normalizeVenue,
  pacificTimeBucketKey
} from "@fresno-events/shared/occurrence";

describe("occurrence fingerprints", () => {
  it("normalizes titles and venues", () => {
    expect(normalizeTitle("Live: Jazz Night!!!")).toBe("jazz night");
    expect(normalizeVenue("Chukchansi Park")).toBe("save-mart-center");
    expect(normalizeVenue("Tower Theatre")).toBe("tower-theatre");
  });

  it("produces stable occurrence keys for the same show", async () => {
    const a = await computeOccurrenceKey("Jazz Night", "2026-06-01T02:00:00.000Z", "Tower Theatre");
    const b = await computeOccurrenceKey("Jazz Night", "2026-06-01T02:00:00.000Z", "Tower Theatre");
    expect(a).toBeTruthy();
    expect(a).toBe(b);
  });

  it("buckets Pacific times to 30 minutes", () => {
    expect(pacificTimeBucketKey("2026-06-01T02:00:00.000Z")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("matches shared ticket URLs via url_key", async () => {
    const url = "https://www.eventbrite.com/e/sample-show-123?aff=abc";
    const a = await computeUrlKey({ ticketUrl: url, externalUrl: undefined });
    const b = await computeUrlKey({
      ticketUrl: "https://www.eventbrite.com/e/sample-show-123?aff=xyz",
      externalUrl: undefined
    });
    expect(a).toBe(b);
  });

  it("returns adjacent bucket lookup keys", async () => {
    const fp = await computeOccurrenceFingerprints({
      title: "Concert",
      startTs: "2026-06-01T02:00:00.000Z",
      venueName: "Rainbow Ballroom",
      ticketUrl: undefined,
      externalUrl: undefined
    });
    expect(fp.occurrenceKeysForLookup.length).toBeGreaterThanOrEqual(1);
  });
});
