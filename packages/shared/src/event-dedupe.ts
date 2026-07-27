export interface EventContentSignatureInput {
  event: { title: string; startTs: string };
  venue: { name?: string | null };
}

export interface EventListingGroupInput {
  event: {
    title: string;
    seriesId?: string | null;
    category?: string;
  };
  venue: { name?: string | null };
}

/**
 * Content signature used to collapse near-identical listings (same show, same
 * venue, same start) that arrive as separate rows from different sources.
 * Title whitespace/case is normalized so cosmetic differences still collide.
 */
export function eventContentSignature(item: EventContentSignatureInput): string {
  const title = item.event.title.trim().toLowerCase().replace(/\s+/g, " ");
  const venue = (item.venue.name ?? "").trim().toLowerCase();
  return `${title}|${venue}|${item.event.startTs}`;
}

/** Removes content-duplicate events, keeping the first occurrence (order preserved). */
export function dedupeEventsByContent<T extends EventContentSignatureInput>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = eventContentSignature(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

/**
 * Groups multi-night runs of the same show (e.g. Grizzlies vs Quakes on Jul 21/22/23)
 * so homepage lists keep one representative. Prefers `seriesId` when present;
 * otherwise title + venue (start time ignored).
 */
export function eventListingGroupKey(item: EventListingGroupInput): string {
  const seriesId = item.event.seriesId?.trim();
  if (seriesId) {
    return `series:${seriesId}`;
  }
  const title = item.event.title.trim().toLowerCase().replace(/\s+/g, " ");
  const venue = (item.venue.name ?? "").trim().toLowerCase();
  return `title:${title}|${venue}`;
}

/** Keeps the first event per listing group (order preserved). */
export function dedupeEventsByListingGroup<T extends EventListingGroupInput>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = eventListingGroupKey(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

export function isSportsEvent(item: { event: { category?: string } }): boolean {
  return item.event.category === "sports";
}

/**
 * Homepage featured diversity: one listing-group per show, and at most one sports
 * event. Keeps earlier items (pinned/priority order) and does not backfill.
 */
export function diversifyHomepageFeatured<T extends EventListingGroupInput>(
  items: T[],
  options: { maxSports?: number } = {}
): T[] {
  const maxSports = options.maxSports ?? 1;
  const seenGroups = new Set<string>();
  let sportsCount = 0;
  const result: T[] = [];

  for (const item of items) {
    const group = eventListingGroupKey(item);
    if (seenGroups.has(group)) {
      continue;
    }
    if (isSportsEvent(item) && sportsCount >= maxSports) {
      continue;
    }
    seenGroups.add(group);
    if (isSportsEvent(item)) {
      sportsCount += 1;
    }
    result.push(item);
  }

  return result;
}
