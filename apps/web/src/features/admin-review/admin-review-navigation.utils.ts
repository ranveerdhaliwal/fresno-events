import type { EventCandidate } from "@fresno-events/shared";

/** Active row must belong to the visible list (respects search/filter). */
export function resolveActiveCandidateId(
  selectedId: string | null,
  navigationItems: EventCandidate[]
): string | null {
  if (selectedId && navigationItems.some((item) => item.id === selectedId)) {
    return selectedId;
  }
  return navigationItems[0]?.id ?? null;
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
