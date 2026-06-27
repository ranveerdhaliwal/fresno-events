import { COMPACT_OCCURRENCE_FETCH_EVENT_THRESHOLD } from "@/candidates/occurrence-match-fetch.utils";

/** Max occurrence rows for linked price harmonize when compact persist is active. */
export const MAX_PRICE_HARMONIZE_OCCURRENCES_COMPACT = 5;

export function useCompactPersistBudget(eventCount: number): boolean {
  return eventCount >= COMPACT_OCCURRENCE_FETCH_EVENT_THRESHOLD;
}

export function capOccurrenceIdsForPriceHarmonize(
  eventCount: number,
  occurrenceIds: readonly string[]
): string[] {
  if (!useCompactPersistBudget(eventCount)) {
    return [...occurrenceIds];
  }
  return [...occurrenceIds].slice(0, MAX_PRICE_HARMONIZE_OCCURRENCES_COMPACT);
}

export function shouldSkipPublishedEventSync(eventCount: number): boolean {
  return useCompactPersistBudget(eventCount);
}
