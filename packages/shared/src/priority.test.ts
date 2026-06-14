import { describe, expect, it } from "vitest";

import {
  clampEventPriority,
  clampSuggestedPriorityForOrganicEvent,
  EVENT_DISPLAY_PRIORITY,
  getEventDisplayPriorityLabel,
  ORGANIC_CANDIDATE_DISPLAY_PRIORITY
} from "./priority.js";

describe("priority", () => {
  it("labels P0 as Sponsored (manual placements only)", () => {
    expect(getEventDisplayPriorityLabel(0)).toBe("Sponsored");
  });

  it("organic review queue excludes P0 tier", () => {
    expect(ORGANIC_CANDIDATE_DISPLAY_PRIORITY.map((tier) => tier.value)).toEqual([1, 2, 3, 4, 5]);
    expect(EVENT_DISPLAY_PRIORITY.some((tier) => tier.value === 0)).toBe(true);
  });

  it("clampSuggestedPriorityForOrganicEvent maps ingest P0 to default P5", () => {
    expect(clampSuggestedPriorityForOrganicEvent(0, false)).toBe(5);
    expect(clampSuggestedPriorityForOrganicEvent(1, false)).toBe(1);
  });

  it("clampEventPriority clamps to 0–5 range", () => {
    expect(clampEventPriority(-1)).toBe(0);
    expect(clampEventPriority(99)).toBe(5);
    expect(clampEventPriority(3)).toBe(3);
  });
});
