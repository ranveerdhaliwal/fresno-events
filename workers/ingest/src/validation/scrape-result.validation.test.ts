import type { ScrapeResult } from "@fresno-events/shared";
import { describe, expect, it } from "vitest";

import { validateScrapeResult } from "./scrape-result.validation";
import type { SourceValidationProfile } from "./source-profiles";

const visitProfile: SourceValidationProfile = {
  scraperKey: "visit-fresno-api",
  eventSource: "api:visitfresnocounty",
  minEventsWarn: 150,
  maxErrors: 0
};

function makeResult(overrides: Partial<ScrapeResult> = {}): ScrapeResult {
  return {
    source: "visit-fresno-api",
    runId: "test-run",
    events: [
      {
        source: "api:visitfresnocounty",
        sourceEventId: "a1",
        title: "Event A",
        venueName: "Venue",
        startTs: "2026-06-01T12:00:00.000Z"
      }
    ],
    errors: [],
    metrics: { pagesVisited: 1, durationMs: 1 },
    ...overrides
  };
}

describe("validateScrapeResult", () => {
  it("passes a valid result", () => {
    const result = validateScrapeResult(makeResult(), visitProfile);
    expect(result.ok).toBe(true);
    expect(result.hard).toHaveLength(0);
  });

  it("hard-fails on duplicate sourceEventId in batch", () => {
    const result = validateScrapeResult(
      makeResult({
        events: [
          {
            source: "api:visitfresnocounty",
            sourceEventId: "dup",
            title: "A",
            venueName: "V",
            startTs: "2026-06-01T12:00:00.000Z"
          },
          {
            source: "api:visitfresnocounty",
            sourceEventId: "dup",
            title: "B",
            venueName: "V",
            startTs: "2026-06-02T12:00:00.000Z"
          }
        ]
      }),
      visitProfile
    );
    expect(result.ok).toBe(false);
    expect(result.hard.some((i) => i.code === "duplicate_source_event_id")).toBe(true);
  });

  it("soft-warns on low event count", () => {
    const result = validateScrapeResult(makeResult({ events: [] }), visitProfile);
    expect(result.ok).toBe(true);
    expect(result.soft.some((i) => i.code === "low_event_count")).toBe(true);
  });

  it("hard-fails when errors exceed maxErrors", () => {
    const result = validateScrapeResult(
      makeResult({
        errors: [{ source: "visit-fresno-api", message: "fail", recoverable: true }]
      }),
      visitProfile
    );
    expect(result.ok).toBe(false);
    expect(result.hard.some((i) => i.code === "too_many_errors")).toBe(true);
  });
});
