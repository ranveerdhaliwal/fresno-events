import { buildEventSlug } from "@/routes/review/mappers.utils";

export interface SlugAuditRow {
  id: string;
  title: string;
  startTs: string;
  occurrenceId?: string | null;
}

export interface SlugCollision {
  candidateId: string;
  title: string;
  startTs: string;
  slug: string;
  reason: "existing_event" | "pending_peer";
  conflictsWith: string;
}

/** Find pending_review primaries whose approve slug would collide. */
export function auditSlugCollisions(
  pending: readonly SlugAuditRow[],
  existingSlugs: readonly string[],
  scheduledOccurrenceIds: ReadonlySet<string> = new Set()
): SlugCollision[] {
  const existing = new Set(existingSlugs);
  const collisions: SlugCollision[] = [];
  const pendingBySlug = new Map<string, string>();

  for (const row of pending) {
    if (row.occurrenceId && scheduledOccurrenceIds.has(row.occurrenceId)) {
      continue;
    }

    const slug = buildEventSlug(row.title, row.startTs);

    if (existing.has(slug)) {
      collisions.push({
        candidateId: row.id,
        title: row.title,
        startTs: row.startTs,
        slug,
        reason: "existing_event",
        conflictsWith: slug
      });
    }

    const peerId = pendingBySlug.get(slug);
    if (peerId) {
      collisions.push({
        candidateId: row.id,
        title: row.title,
        startTs: row.startTs,
        slug,
        reason: "pending_peer",
        conflictsWith: peerId
      });
    } else {
      pendingBySlug.set(slug, row.id);
    }
  }

  return collisions;
}
