import type { OccurrenceFingerprints } from "@fresno-events/shared";
import { isUniquePerPerformanceListingUrl, normalizedListingUrlForEvent } from "@fresno-events/shared";

/** True when two rows could match on occurrence_key (same title/venue ±1 Pacific bucket). */
export function occurrenceLookupKeysOverlap(
  left: Pick<OccurrenceFingerprints, "occurrenceKeysForLookup">,
  right: Pick<OccurrenceFingerprints, "occurrenceKeysForLookup">
): boolean {
  const leftKeys = new Set(left.occurrenceKeysForLookup);
  return right.occurrenceKeysForLookup.some((key) => leftKeys.has(key));
}

/** True when url_key lookup should link despite Pacific bucket drift (e.g. Save Mart date off by one day). */
export function urlKeyLinksAcrossSources(
  fingerprints: Pick<OccurrenceFingerprints, "occurrenceKeysForLookup">,
  candidateOccurrenceKey: string | null,
  listingUrls: { ticketUrl?: string; externalUrl?: string }
): boolean {
  if (isUniquePerPerformanceListingUrl(normalizedListingUrlForEvent(listingUrls))) {
    return true;
  }
  return urlKeyLinksWithOccurrenceLookup(fingerprints, candidateOccurrenceKey);
}

/**
 * Legacy guard for series pages that share a url_key across nights.
 * Prefer urlKeyLinksAcrossSources when listing URLs are available.
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
