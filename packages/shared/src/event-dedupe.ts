export interface EventContentSignatureInput {
  event: { title: string; startTs: string };
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
