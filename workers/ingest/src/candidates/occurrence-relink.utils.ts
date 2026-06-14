import type { NormalizedEvent } from "@fresno-events/shared";
import {
  computeOccurrenceFingerprints,
  listingUrlsReferToSamePerformance,
  sha256Hex,
  sourcePriorityRank
} from "@fresno-events/shared";

import type { OccurrenceMatchCandidate } from "@/candidates/occurrence-match.types";
import { occurrenceLookupKeysOverlap } from "@/candidates/occurrence-url-link.utils";
import { primaryPriorityInheritUpdate } from "@/candidates/linked-priority.utils";

export interface RelinkCandidateRow {
  id: string;
  source: string;
  source_event_id: string;
  status: string;
  matched_event_id: string | null;
  canonical_candidate_id: string | null;
  occurrence_id: string | null;
  occurrence_key: string | null;
  url_key: string | null;
  suggested_priority: number | null;
  created_at: string;
  normalized_event: NormalizedEvent;
}

export interface RelinkPublishedEvent {
  id: string;
  occurrence_id: string | null;
  occurrence_key: string | null;
  status: string;
}

export interface RelinkPatch {
  id: string;
  occurrence_id: string;
  occurrence_key: string | null;
  url_key: string | null;
  canonical_candidate_id: string | null;
  matched_event_id: string | null;
  status: string;
  suggested_priority?: number;
}

export interface RelinkLinkExample {
  title: string;
  primary_source: string;
  linked_sources: string[];
  cross_source: boolean;
  would_change: boolean;
}

export interface RelinkPlanSummary {
  candidates: number;
  relinkable: number;
  skipped_rejected: number;
  groups: number;
  multi_source_groups: number;
  patches: number;
  linked_as_duplicate: number;
  promoted_from_duplicate: number;
  demoted_to_duplicate: number;
  occurrence_key_changed: number;
  occurrence_id_changed: number;
  priority_inherited: number;
  link_groups: number;
  link_groups_changed: number;
  link_examples: RelinkLinkExample[];
}

const RELINKABLE_STATUSES = new Set([
  "awaiting_enrichment",
  "pending_review",
  "needs_changes",
  "approved",
  "duplicate"
]);

class UnionFind {
  private readonly parent = new Map<string, string>();

  add(id: string) {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
    }
  }

  find(id: string): string {
    const parent = this.parent.get(id);
    if (!parent || parent === id) {
      return id;
    }
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string) {
    this.add(a);
    this.add(b);
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent.set(rootB, rootA);
    }
  }
}

function pickRelinkPrimary(group: RelinkCandidateRow[]): RelinkCandidateRow {
  const pool = group.filter((row) => row.status !== "rejected");
  if (pool.length === 0) {
    return group[0]!;
  }

  const publishedPool = pool.filter((row) => row.matched_event_id);
  const rankingPool = publishedPool.length > 0 ? publishedPool : pool;

  return [...rankingPool].sort((left, right) => rankRelinkPrimary(left, right, publishedPool.length > 0))[0]!;
}

/** When rows are on the calendar, prefer the original non-TM publisher over Ticketmaster. */
function rankRelinkPrimary(left: RelinkCandidateRow, right: RelinkCandidateRow, publishedGroup: boolean): number {
  if (publishedGroup) {
    const leftIsTm = left.source === "ticketmaster";
    const rightIsTm = right.source === "ticketmaster";
    if (leftIsTm !== rightIsTm) {
      return leftIsTm ? 1 : -1;
    }
    if (left.status === "approved" && right.status !== "approved") {
      return -1;
    }
    if (left.status !== "approved" && right.status === "approved") {
      return 1;
    }
    return left.created_at.localeCompare(right.created_at);
  }

  const leftRank = toMatchCandidate({
    ...left,
    status: left.status === "duplicate" ? "pending_review" : left.status,
    canonical_candidate_id: null
  });
  const rightRank = toMatchCandidate({
    ...right,
    status: right.status === "duplicate" ? "pending_review" : right.status,
    canonical_candidate_id: null
  });
  return rankUnpublishedPrimary(leftRank, rightRank);
}

function rankUnpublishedPrimary(left: OccurrenceMatchCandidate, right: OccurrenceMatchCandidate): number {
  if (left.status === "approved" && right.status !== "approved") {
    return -1;
  }
  if (left.status !== "approved" && right.status === "approved") {
    return 1;
  }
  const sourceRank = sourcePriorityRank(left.source) - sourcePriorityRank(right.source);
  if (sourceRank !== 0) {
    return sourceRank;
  }
  return left.created_at.localeCompare(right.created_at);
}

/** Stable UUID derived from occurrence_key so each show night keeps one id across relinks. */
export async function occurrenceIdFromKey(occurrenceKey: string): Promise<string> {
  const hash = await sha256Hex(`occurrence-id|${occurrenceKey}`);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function toMatchCandidate(row: RelinkCandidateRow): OccurrenceMatchCandidate {
  return {
    id: row.id,
    source: row.source,
    source_event_id: row.source_event_id,
    status: row.status,
    matched_event_id: row.matched_event_id,
    occurrence_id: row.occurrence_id ?? "",
    canonical_candidate_id: row.canonical_candidate_id,
    created_at: row.created_at,
    occurrence_key: row.occurrence_key,
    url_key: row.url_key
  };
}

function findScheduledEvent(
  publishedByOccurrenceKey: Map<string, RelinkPublishedEvent[]>,
  publishedByOccurrenceId: Map<string, RelinkPublishedEvent[]>,
  occurrenceId: string,
  occurrenceKey: string | null
): RelinkPublishedEvent | null {
  if (occurrenceId) {
    const byId = publishedByOccurrenceId.get(occurrenceId) ?? [];
    const scheduled = byId.find((row) => row.status === "scheduled");
    if (scheduled) {
      return scheduled;
    }
  }

  if (occurrenceKey) {
    const byKey = publishedByOccurrenceKey.get(occurrenceKey) ?? [];
    const scheduled = byKey.find((row) => row.status === "scheduled");
    if (scheduled) {
      return scheduled;
    }
  }

  return null;
}

function resolveRelinkStatus(row: RelinkCandidateRow, isPrimary: boolean, crossSourceDedupe: boolean): string {
  if (!crossSourceDedupe || isPrimary) {
    if (row.status === "duplicate") {
      return row.matched_event_id ? "approved" : "pending_review";
    }
    return row.status;
  }
  if (row.status === "needs_changes") {
    return row.status;
  }
  return "duplicate";
}

function formatRelinkSourceLabel(source: string): string {
  return source
    .replace(/^api:/, "")
    .replace(/^scrape:/, "")
    .replace(/_/g, " ")
    .trim();
}

export function summarizeRelinkLinkGroups(
  rows: RelinkCandidateRow[],
  patches: RelinkPatch[],
  changedIds: Set<string>,
  options: { crossSourceDedupe: boolean; maxExamples?: number }
): Pick<RelinkPlanSummary, "link_groups" | "link_groups_changed" | "link_examples"> {
  if (!options.crossSourceDedupe) {
    return { link_groups: 0, link_groups_changed: 0, link_examples: [] };
  }

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const byOccurrence = new Map<string, RelinkPatch[]>();
  for (const patch of patches) {
    const bucket = byOccurrence.get(patch.occurrence_id) ?? [];
    bucket.push(patch);
    byOccurrence.set(patch.occurrence_id, bucket);
  }

  let linkGroups = 0;
  let linkGroupsChanged = 0;
  const examples: RelinkLinkExample[] = [];

  for (const groupPatches of byOccurrence.values()) {
    if (groupPatches.length < 2) {
      continue;
    }

    const primaryPatch = groupPatches.find((patch) => patch.canonical_candidate_id === null);
    if (!primaryPatch) {
      continue;
    }

    const linkedPatches = groupPatches.filter((patch) => patch.canonical_candidate_id === primaryPatch.id);
    if (linkedPatches.length === 0) {
      continue;
    }

    linkGroups += 1;
    const wouldChange = groupPatches.some((patch) => changedIds.has(patch.id));
    if (wouldChange) {
      linkGroupsChanged += 1;
    }

    const primaryRow = rowById.get(primaryPatch.id);
    if (!primaryRow) {
      continue;
    }

    const sources = new Set(
      groupPatches.map((patch) => rowById.get(patch.id)?.source).filter((source): source is string => Boolean(source))
    );

    examples.push({
      title: primaryRow.normalized_event.title,
      primary_source: formatRelinkSourceLabel(primaryRow.source),
      linked_sources: [
        ...new Set(
          linkedPatches.map((patch) => formatRelinkSourceLabel(rowById.get(patch.id)!.source))
        )
      ],
      cross_source: sources.size > 1,
      would_change: wouldChange
    });
  }

  examples.sort((left, right) => {
    if (left.would_change !== right.would_change) {
      return left.would_change ? -1 : 1;
    }
    if (left.cross_source !== right.cross_source) {
      return left.cross_source ? -1 : 1;
    }
    return right.linked_sources.length - left.linked_sources.length;
  });

  return {
    link_groups: linkGroups,
    link_groups_changed: linkGroupsChanged,
    link_examples: examples.slice(0, options.maxExamples ?? 10)
  };
}

export async function computeRelinkPatches(
  rows: RelinkCandidateRow[],
  publishedEvents: RelinkPublishedEvent[],
  options: { crossSourceDedupe: boolean }
): Promise<{ patches: RelinkPatch[]; summary: RelinkPlanSummary }> {
  const relinkable = rows.filter((row) => RELINKABLE_STATUSES.has(row.status));
  const skippedRejected = rows.length - relinkable.length;

  const fingerprints = new Map<string, Awaited<ReturnType<typeof computeOccurrenceFingerprints>>>();
  for (const row of relinkable) {
    fingerprints.set(row.id, await computeOccurrenceFingerprints(row.normalized_event));
  }

  const uf = new UnionFind();
  const keyToIds = new Map<string, string[]>();
  const urlToIds = new Map<string, string[]>();

  for (const row of relinkable) {
    uf.add(row.id);
    const fp = fingerprints.get(row.id)!;
    for (const key of fp.occurrenceKeysForLookup) {
      const bucket = keyToIds.get(key) ?? [];
      bucket.push(row.id);
      keyToIds.set(key, bucket);
    }
    if (fp.urlKey) {
      const bucket = urlToIds.get(fp.urlKey) ?? [];
      bucket.push(row.id);
      urlToIds.set(fp.urlKey, bucket);
    }
  }

  for (const ids of keyToIds.values()) {
    for (let index = 1; index < ids.length; index += 1) {
      uf.union(ids[0]!, ids[index]!);
    }
  }
  for (const ids of urlToIds.values()) {
    if (ids.length <= 1) {
      continue;
    }
    for (let left = 0; left < ids.length; left += 1) {
      for (let right = left + 1; right < ids.length; right += 1) {
        const leftId = ids[left]!;
        const rightId = ids[right]!;
        const leftRow = relinkable.find((row) => row.id === leftId)!;
        const rightRow = relinkable.find((row) => row.id === rightId)!;
        const leftFp = fingerprints.get(leftId)!;
        const rightFp = fingerprints.get(rightId)!;
        if (
          occurrenceLookupKeysOverlap(leftFp, rightFp) ||
          listingUrlsReferToSamePerformance(leftRow.normalized_event, rightRow.normalized_event)
        ) {
          uf.union(leftId, rightId);
        }
      }
    }
  }

  const groupsByRoot = new Map<string, RelinkCandidateRow[]>();
  for (const row of relinkable) {
    const root = uf.find(row.id);
    const group = groupsByRoot.get(root) ?? [];
    group.push(row);
    groupsByRoot.set(root, group);
  }

  const publishedByOccurrenceKey = new Map<string, RelinkPublishedEvent[]>();
  const publishedByOccurrenceId = new Map<string, RelinkPublishedEvent[]>();
  for (const event of publishedEvents) {
    if (event.occurrence_key) {
      const bucket = publishedByOccurrenceKey.get(event.occurrence_key) ?? [];
      bucket.push(event);
      publishedByOccurrenceKey.set(event.occurrence_key, bucket);
    }
    if (event.occurrence_id) {
      const bucket = publishedByOccurrenceId.get(event.occurrence_id) ?? [];
      bucket.push(event);
      publishedByOccurrenceId.set(event.occurrence_id, bucket);
    }
  }

  const patches: RelinkPatch[] = [];
  let linkedAsDuplicate = 0;
  let promotedFromDuplicate = 0;
  let demotedToDuplicate = 0;
  let occurrenceKeyChanged = 0;
  let occurrenceIdChanged = 0;
  let priorityInherited = 0;
  let multiSourceGroups = 0;
  const occurrenceIdByKey = new Map<string, string>();

  for (const group of groupsByRoot.values()) {
    const sources = new Set(group.map((row) => row.source));
    if (sources.size > 1) {
      multiSourceGroups += 1;
    }

    const primary = pickRelinkPrimary(group);
    const primaryFp = fingerprints.get(primary.id)!;
    const occurrenceKey = primaryFp.occurrenceKey || null;
    let occurrenceId: string;
    if (occurrenceKey) {
      if (!occurrenceIdByKey.has(occurrenceKey)) {
        occurrenceIdByKey.set(occurrenceKey, await occurrenceIdFromKey(occurrenceKey));
      }
      occurrenceId = occurrenceIdByKey.get(occurrenceKey)!;
    } else {
      occurrenceId = crypto.randomUUID();
    }
    const published = findScheduledEvent(
      publishedByOccurrenceKey,
      publishedByOccurrenceId,
      occurrenceId,
      occurrenceKey
    );

    for (const row of group) {
      const fp = fingerprints.get(row.id)!;
      const isPrimary = row.id === primary.id;
      const nextStatus = resolveRelinkStatus(row, isPrimary, options.crossSourceDedupe);

      let canonicalCandidateId: string | null = null;
      let matchedEventId = row.matched_event_id;

      if (options.crossSourceDedupe) {
        if (published) {
          matchedEventId = published.id;
          if (!isPrimary) {
            canonicalCandidateId = primary.id;
          }
        } else if (!isPrimary) {
          canonicalCandidateId = primary.id;
          matchedEventId = primary.matched_event_id ?? matchedEventId;
        } else {
          matchedEventId = primary.matched_event_id ?? matchedEventId;
        }
      }

      if (!isPrimary && options.crossSourceDedupe && canonicalCandidateId) {
        linkedAsDuplicate += 1;
      }
      if (row.status === "duplicate" && isPrimary) {
        promotedFromDuplicate += 1;
      }
      if (row.status !== "duplicate" && nextStatus === "duplicate") {
        demotedToDuplicate += 1;
      }
      if (row.occurrence_key !== fp.occurrenceKey) {
        occurrenceKeyChanged += 1;
      }
      if (row.occurrence_id !== occurrenceId) {
        occurrenceIdChanged += 1;
      }

      patches.push({
        id: row.id,
        occurrence_id: occurrenceId,
        occurrence_key: occurrenceKey,
        url_key: primaryFp.urlKey ?? fp.urlKey,
        canonical_candidate_id: canonicalCandidateId,
        matched_event_id: matchedEventId,
        status: nextStatus
      });
    }

    if (options.crossSourceDedupe && group.length > 1) {
      const priorityInherit = primaryPriorityInheritUpdate(
        group.map((row) => ({
          id: row.id,
          source: row.source,
          suggested_priority: row.suggested_priority,
          canonical_candidate_id: row.id === primary.id ? null : primary.id
        }))
      );
      if (priorityInherit) {
        const primaryPatch = patches.find((patch) => patch.id === priorityInherit.primaryId);
        if (primaryPatch) {
          primaryPatch.suggested_priority = priorityInherit.toPriority;
          priorityInherited += 1;
        }
      }
    }
  }

  return {
    patches,
    summary: {
      candidates: rows.length,
      relinkable: relinkable.length,
      skipped_rejected: skippedRejected,
      groups: groupsByRoot.size,
      multi_source_groups: multiSourceGroups,
      patches: patches.length,
      linked_as_duplicate: linkedAsDuplicate,
      promoted_from_duplicate: promotedFromDuplicate,
      demoted_to_duplicate: demotedToDuplicate,
      occurrence_key_changed: occurrenceKeyChanged,
      occurrence_id_changed: occurrenceIdChanged,
      priority_inherited: priorityInherited,
      link_groups: 0,
      link_groups_changed: 0,
      link_examples: []
    }
  };
}
