import { eventContentSignature } from "./event-dedupe.js";

export interface PublishedEventAuditRow {
  id: string;
  slug: string;
  title: string;
  startTs: string;
  venueName: string;
  source: string;
  occurrenceId: string | null;
}

export interface PublishedOrphanDeletion {
  eventId: string;
  slug: string;
  title: string;
  keepEventId: string;
  keepSlug: string;
  reason: "content_duplicate_published";
}

/** Groups scheduled events that describe the same real-world show. */
export function groupPublishedEventsByContent(events: PublishedEventAuditRow[]): PublishedEventAuditRow[][] {
  const map = new Map<string, PublishedEventAuditRow[]>();

  for (const event of events) {
    const signature = eventContentSignature({
      event: { title: event.title, startTs: event.startTs },
      venue: { name: event.venueName }
    });
    const bucket = map.get(signature) ?? [];
    bucket.push(event);
    map.set(signature, bucket);
  }

  return [...map.values()].filter((group) => group.length > 1);
}

const SOURCE_KEEP_ORDER = ["scrape:", "api:", "ticketmaster", "venunite"];

function sourceKeepRank(source: string): number {
  const index = SOURCE_KEEP_ORDER.findIndex((prefix) => source.startsWith(prefix) || source === prefix);
  return index === -1 ? SOURCE_KEEP_ORDER.length : index;
}

/**
 * Pick the canonical published row for a content-duplicate group.
 * Duplicate-candidate votes win; otherwise prefer venue scrapers/API over Ticketmaster.
 */
export function pickCanonicalPublishedEvent(
  group: PublishedEventAuditRow[],
  canonicalVotes: ReadonlyMap<string, number>
): PublishedEventAuditRow {
  return [...group].sort((left, right) => {
    const voteDelta = (canonicalVotes.get(right.id) ?? 0) - (canonicalVotes.get(left.id) ?? 0);
    if (voteDelta !== 0) {
      return voteDelta;
    }

    const sourceDelta = sourceKeepRank(left.source) - sourceKeepRank(right.source);
    if (sourceDelta !== 0) {
      return sourceDelta;
    }

    return left.id.localeCompare(right.id);
  })[0]!;
}

/** Plans orphan deletions for published rows that share a content signature. */
export function planPublishedOrphanDeletions(
  events: PublishedEventAuditRow[],
  canonicalVotes: ReadonlyMap<string, number>
): PublishedOrphanDeletion[] {
  const deletions: PublishedOrphanDeletion[] = [];

  for (const group of groupPublishedEventsByContent(events)) {
    const keep = pickCanonicalPublishedEvent(group, canonicalVotes);
    for (const row of group) {
      if (row.id === keep.id) {
        continue;
      }
      deletions.push({
        eventId: row.id,
        slug: row.slug,
        title: row.title,
        keepEventId: keep.id,
        keepSlug: keep.slug,
        reason: "content_duplicate_published"
      });
    }
  }

  return deletions;
}
