import { describe, expect, it } from "vitest";

import {
  bestSuggestedPriority,
  primaryPriorityInheritUpdate,
  type LinkedPriorityMember
} from "@/candidates/linked-priority.utils";

function member(
  patch: Partial<LinkedPriorityMember> & Pick<LinkedPriorityMember, "id">
): LinkedPriorityMember {
  return {
    source: "ticketmaster",
    suggested_priority: 5,
    canonical_candidate_id: null,
    ...patch
  };
}

describe("linked-priority.utils", () => {
  it("bestSuggestedPriority picks the lowest value", () => {
    const group = [
      member({ id: "tm", suggested_priority: 5 }),
      member({
        id: "sm",
        source: "scrape:www.savemartcenter.com",
        suggested_priority: 1,
        canonical_candidate_id: "tm"
      })
    ];
    expect(bestSuggestedPriority(group)).toBe(1);
  });

  it("primaryPriorityInheritUpdate lowers ticketmaster primary when duplicate scored better", () => {
    const group = [
      member({ id: "tm", suggested_priority: 5 }),
      member({
        id: "sm",
        source: "scrape:www.savemartcenter.com",
        suggested_priority: 1,
        canonical_candidate_id: "tm"
      })
    ];
    expect(primaryPriorityInheritUpdate(group)).toEqual({
      primaryId: "tm",
      fromPriority: 5,
      toPriority: 1
    });
  });

  it("primaryPriorityInheritUpdate is null when primary already has best priority", () => {
    const group = [
      member({ id: "tm", suggested_priority: 1 }),
      member({
        id: "sm",
        source: "scrape:www.savemartcenter.com",
        suggested_priority: 5,
        canonical_candidate_id: "tm"
      })
    ];
    expect(primaryPriorityInheritUpdate(group)).toBeNull();
  });
});
