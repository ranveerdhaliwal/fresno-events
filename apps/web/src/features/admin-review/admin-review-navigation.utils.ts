import type { EventCandidate, EventCandidateStatus } from "@fresno-events/shared";

import type { ReviewQueueTab } from "../admin/admin-api";

/** Active row must belong to the visible list when the list has items (search/filter). */
export function resolveActiveCandidateId(
  selectedId: string | null,
  navigationItems: EventCandidate[]
): string | null {
  if (
    selectedId &&
    (navigationItems.length === 0 || navigationItems.some((item) => item.id === selectedId))
  ) {
    return selectedId;
  }
  return navigationItems[0]?.id ?? null;
}

export function candidateStatusToReviewTab(status: EventCandidateStatus): ReviewQueueTab {
  if (status === "needs_changes") {
    return "updates";
  }
  if (status === "approved") {
    return "approved";
  }
  if (status === "rejected") {
    return "rejected";
  }
  return "new";
}

/**
 * After approve/reject/delete, pick the next row in the current visible list.
 * Prefers the item that was below the decided row; otherwise the one above.
 */
export function selectNextAfterDecision(
  navigationItems: EventCandidate[],
  decidedId: string
): string | null {
  const idx = navigationItems.findIndex((item) => item.id === decidedId);
  const afterRemoval = navigationItems.filter((item) => item.id !== decidedId);
  if (afterRemoval.length === 0) {
    return null;
  }
  if (idx === -1) {
    return afterRemoval[0]?.id ?? null;
  }
  const nextIdx = Math.min(idx, afterRemoval.length - 1);
  return afterRemoval[nextIdx]?.id ?? null;
}
