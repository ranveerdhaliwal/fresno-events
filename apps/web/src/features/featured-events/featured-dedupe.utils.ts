import { dedupeEventsByContent, eventContentSignature, type EventListItem } from "@fresno-events/shared";

/** Content signature for a featured slot's event (see shared eventContentSignature). */
export function featuredDedupeKey(item: EventListItem): string {
  return eventContentSignature(item);
}

/**
 * Removes duplicate featured slots by event content signature, keeping the first
 * occurrence so pinned/priority ordering upstream is respected.
 */
export function dedupeFeaturedItems<T extends { item: EventListItem }>(slots: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const slot of slots) {
    const key = featuredDedupeKey(slot.item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(slot);
  }
  return result;
}

/** Same content-signature dedupe for a flat list of events (e.g. biggest month). */
export function dedupeEventItems(items: EventListItem[]): EventListItem[] {
  return dedupeEventsByContent(items);
}
