import { describe, expect, it } from "vitest";

import type { NormalizedEvent } from "@fresno-events/shared";

import {
  isGobulldogsFinalEvent,
  isGobulldogsFootball,
  resolveGobulldogsPriority
} from "./gobulldogs-priority.utils";

function bulldogsEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    source: "api:gobulldogs",
    sourceEventId: "gobulldogs:game:1",
    title: "Women's Volleyball vs UCSB",
    venueName: "Save Mart Center",
    startTs: "2026-08-15T00:00:00.000Z",
    category: "sports",
    ...overrides
  };
}

describe("gobulldogs-priority.utils", () => {
  it("ranks football above other bulldogs sports", () => {
    expect(resolveGobulldogsPriority(bulldogsEvent())?.priority).toBe(4);
    expect(resolveGobulldogsPriority(bulldogsEvent({ title: "Football vs USC" }))?.priority).toBe(3);
    expect(isGobulldogsFootball(bulldogsEvent({ title: "Football at USC" }))).toBe(true);
  });

  it("bumps finals and championships one priority level", () => {
    expect(
      resolveGobulldogsPriority(
        bulldogsEvent({ title: "Women's Volleyball vs Ohio State", descriptionText: "Conference Championship" })
      )?.priority
    ).toBe(3);
    expect(
      resolveGobulldogsPriority(
        bulldogsEvent({ title: "Football vs San Diego State", descriptionText: "Mountain West Championship" })
      )?.priority
    ).toBe(2);
    expect(isGobulldogsFinalEvent(bulldogsEvent({ descriptionText: "Semifinal" }))).toBe(true);
  });

  it("ignores unrelated sources", () => {
    expect(resolveGobulldogsPriority({ ...bulldogsEvent(), source: "api:milb" })).toBeNull();
  });
});
