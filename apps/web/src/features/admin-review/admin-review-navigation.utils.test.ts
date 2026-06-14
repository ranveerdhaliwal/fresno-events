import { describe, expect, it } from "vitest";

import type { EventCandidate } from "@fresno-events/shared";

import {
  resolveActiveCandidateId,
  selectNextAfterDecision
} from "./admin-review-navigation.utils";

function candidate(id: string): EventCandidate {
  return {
    id,
    source: "ticketmaster",
    sourceEventId: id,
    title: id,
    venueName: "Venue",
    startTs: "2026-10-01T00:00:00.000Z",
    normalizedEvent: {
      source: "ticketmaster",
      sourceEventId: id,
      title: id,
      venueName: "Venue",
      startTs: "2026-10-01T00:00:00.000Z",
      category: "music",
      subcategories: [],
      tags: [],
      currency: "USD"
    },
    rawPayload: {},
    dedupeHash: id,
    confidenceScore: 1,
    status: "pending_review",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    detailStatus: "pending",
    occurrenceId: id
  };
}

describe("resolveActiveCandidateId", () => {
  const items = [candidate("a"), candidate("b")];

  it("keeps selection when it is in the visible list", () => {
    expect(resolveActiveCandidateId("b", items)).toBe("b");
  });

  it("falls back to the first visible row when selection is outside the list", () => {
    expect(resolveActiveCandidateId("missing", items)).toBe("a");
  });

  it("returns null when the visible list is empty", () => {
    expect(resolveActiveCandidateId("a", [])).toBeNull();
    expect(resolveActiveCandidateId(null, [])).toBeNull();
  });
});

describe("selectNextAfterDecision", () => {
  const items = [candidate("a"), candidate("b"), candidate("c")];

  it("selects the next row after the decided item", () => {
    expect(selectNextAfterDecision(items, "a")).toBe("b");
    expect(selectNextAfterDecision(items, "b")).toBe("c");
  });

  it("selects the previous row when the decided item was last", () => {
    expect(selectNextAfterDecision(items, "c")).toBe("b");
  });

  it("returns null when the list becomes empty", () => {
    expect(selectNextAfterDecision([candidate("only")], "only")).toBeNull();
  });
});
