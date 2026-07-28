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

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeVenue(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase();
}

/**
 * Content signature used to collapse near-identical listings (same show, same
 * venue, same start) that arrive as separate rows from different sources.
 * Title whitespace/case is normalized so cosmetic differences still collide.
 */
export function eventContentSignature(item: EventContentSignatureInput): string {
  const title = normalizeTitle(item.event.title);
  const venue = normalizeVenue(item.venue.name);
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
 * Listing-group keys for a show. Always includes normalized title+venue so
 * multi-night runs collide even when each night has a different `seriesId`.
 * Also includes `series:{id}` when present so differently titled siblings in
 * the same series still collapse together.
 */
export function eventListingGroupKeys(item: EventListingGroupInput): string[] {
  const title = normalizeTitle(item.event.title);
  const venue = normalizeVenue(item.venue.name);
  const keys = [`title:${title}|${venue}`];
  const seriesId = item.event.seriesId?.trim();
  if (seriesId) {
    keys.push(`series:${seriesId}`);
  }
  return keys;
}

/**
 * Primary listing-group key (title+venue). Prefer {@link eventListingGroupKeys}
 * + {@link listingGroupAlreadySeen} when merging pools.
 */
export function eventListingGroupKey(item: EventListingGroupInput): string {
  return eventListingGroupKeys(item)[0]!;
}

export function listingGroupAlreadySeen(
  item: EventListingGroupInput,
  seenGroups: Set<string>
): boolean {
  return eventListingGroupKeys(item).some((key) => seenGroups.has(key));
}

export function markListingGroupsSeen(item: EventListingGroupInput, seenGroups: Set<string>): void {
  for (const key of eventListingGroupKeys(item)) {
    seenGroups.add(key);
  }
}

/** Keeps the first event per listing group (order preserved). */
export function dedupeEventsByListingGroup<T extends EventListingGroupInput>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (listingGroupAlreadySeen(item, seen)) {
      continue;
    }
    markListingGroupsSeen(item, seen);
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
    if (listingGroupAlreadySeen(item, seenGroups)) {
      continue;
    }
    if (isSportsEvent(item) && sportsCount >= maxSports) {
      continue;
    }
    markListingGroupsSeen(item, seenGroups);
    if (isSportsEvent(item)) {
      sportsCount += 1;
    }
    result.push(item);
  }

  return result;
}
