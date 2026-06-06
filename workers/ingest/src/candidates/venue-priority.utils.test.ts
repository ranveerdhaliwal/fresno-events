import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import { applyVenuePriorityOverride, resolveVenueSuggestedPriority } from "./venue-priority.utils";

function milbEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    source: "api:milb",
    sourceEventId: "123",
    title: "Fresno Grizzlies vs Lake Elsinore Storm",
    venueName: "Chukchansi Park",
    startTs: "2026-06-06T01:50:00.000Z",
    category: "sports",
    ...overrides
  };
}

describe("venue-priority.utils", () => {
  it("defaults MiLB Grizzlies games to priority 3", () => {
    expect(resolveVenueSuggestedPriority(milbEvent())).toBe(3);
    expect(resolveVenueSuggestedPriority(milbEvent({ venueName: "Valley Strong Ballpark" }))).toBe(3);
  });

  it("does not match unrelated sources", () => {
    expect(
      resolveVenueSuggestedPriority({
        source: "api:visitfresnocounty",
        sourceEventId: "x",
        title: "Concert",
        venueName: "Chukchansi Park",
        startTs: "2026-06-06T01:50:00.000Z"
      })
    ).toBeNull();
  });

  it("overrides AI priority and appends venue note", () => {
    const result = applyVenuePriorityOverride(milbEvent(), 2, "[ai] major sports event");
    expect(result.suggested_priority).toBe(3);
    expect(result.review_notes).toContain("[venue] Grizzlies / MiLB → P3");
  });
});
