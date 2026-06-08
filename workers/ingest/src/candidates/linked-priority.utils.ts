import { EVENT_PRIORITY_DEFAULT } from "@fresno-events/shared";

export interface LinkedPriorityMember {
  id: string;
  source: string;
  suggested_priority: number | null;
  canonical_candidate_id: string | null;
}

/** Best (lowest) display priority across linked rows; missing values count as P5. */
export function bestSuggestedPriority(members: readonly LinkedPriorityMember[]): number {
  if (members.length === 0) {
    return EVENT_PRIORITY_DEFAULT;
  }
  return Math.min(...members.map((member) => member.suggested_priority ?? EVENT_PRIORITY_DEFAULT));
}

/**
 * When a primary is linked to duplicates with better editorial priority, inherit the best score.
 * Returns null when the primary already has the best priority in the group.
 */
export function primaryPriorityInheritUpdate(
  group: readonly LinkedPriorityMember[]
): { primaryId: string; fromPriority: number; toPriority: number } | null {
  const primary = group.find((member) => member.canonical_candidate_id === null);
  if (!primary) {
    return null;
  }

  const best = bestSuggestedPriority(group);
  const current = primary.suggested_priority ?? EVENT_PRIORITY_DEFAULT;
  if (current <= best) {
    return null;
  }

  return { primaryId: primary.id, fromPriority: current, toPriority: best };
}
