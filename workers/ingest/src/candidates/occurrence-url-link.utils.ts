import type { OccurrenceFingerprints } from "@fresno-events/shared";

/** True when two rows could match on occurrence_key (same title/venue ±1 Pacific bucket). */
export function occurrenceLookupKeysOverlap(
  left: Pick<OccurrenceFingerprints, "occurrenceKeysForLookup">,
  right: Pick<OccurrenceFingerprints, "occurrenceKeysForLookup">
): boolean {
  const leftKeys = new Set(left.occurrenceKeysForLookup);
  return right.occurrenceKeysForLookup.some((key) => leftKeys.has(key));
}

/**
 * url_key may repeat on multi-night series pages — only link when occurrence buckets overlap.
 */
export function urlKeyLinksWithOccurrenceLookup(
  fingerprints: Pick<OccurrenceFingerprints, "occurrenceKeysForLookup">,
  candidateOccurrenceKey: string | null
): boolean {
  if (!candidateOccurrenceKey) {
    return false;
  }
  return fingerprints.occurrenceKeysForLookup.includes(candidateOccurrenceKey);
}
