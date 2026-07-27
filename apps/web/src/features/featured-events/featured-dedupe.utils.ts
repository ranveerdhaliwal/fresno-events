import {
  dedupeEventsByContent,
  dedupeEventsByListingGroup,
  diversifyHomepageFeatured,
  eventContentSignature,
  type EventListItem
} from "@fresno-events/shared";

/** Content signature for a featured slot's event (see shared eventContentSignature). */
export function featuredDedupeKey(item: EventListItem): string {
  return eventContentSignature(item);
}

/**
 * Removes duplicate featured slots by listing group + sports cap, keeping the
 * first occurrence so pinned/priority ordering upstream is respected.
 */
export function dedupeFeaturedItems<T extends { item: EventListItem }>(slots: T[]): T[] {
  const kept = diversifyHomepageFeatured(slots.map((slot) => slot.item));
  const allowed = new Set(kept.map((item) => item.event.id));
  return slots.filter((slot) => allowed.has(slot.item.event.id));
}

/**
 * Biggest-month list: collapse source duplicates, then multi-night runs of the
 * same show (title+venue or seriesId).
 */
export function dedupeEventItems(items: EventListItem[]): EventListItem[] {
  return dedupeEventsByListingGroup(dedupeEventsByContent(items));
}
