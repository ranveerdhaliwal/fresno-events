import type { NormalizedEvent } from "@fresno-events/shared";

export const FINGERPRINT_DIFF_FIELDS = [
  "title",
  "venueName",
  "startTs",
  "endTs",
  "descriptionText",
  "venueAddress",
  "venueCity",
  "ticketUrl",
  "externalUrl",
  "category"
] as const;

export type FingerprintDiffField = (typeof FINGERPRINT_DIFF_FIELDS)[number];

export interface PersistAuditItemNew {
  source_event_id: string;
  title: string;
  start_ts: string;
  venue_name: string;
  source: string;
  external_url?: string;
}

export interface PersistAuditItemChanged {
  source_event_id: string;
  title: string;
  changed_fields: FingerprintDiffField[];
  before: Partial<Record<FingerprintDiffField, string | null>>;
  after: Partial<Record<FingerprintDiffField, string | null>>;
}

/** Same real-world occurrence scraped twice in one batch (series CMS dupes, title drift). */
export interface PersistAuditItemBatchDuplicate {
  title: string;
  start_ts: string;
  venue_name: string;
  source: string;
  source_event_id: string;
  kept_source_event_id: string;
  kept_title: string;
  match: "occurrence_key" | "url_key" | "loose_title";
  /** Dropped row's public event page. */
  external_url?: string;
  /** Kept row's public event page (for side-by-side verification). */
  kept_external_url?: string;
}

export interface PersistAuditSummary {
  new: number;
  changed: number;
  unchanged: number;
  new_items: PersistAuditItemNew[];
  changed_items: PersistAuditItemChanged[];
  batch_duplicates?: number;
  batch_duplicate_items?: PersistAuditItemBatchDuplicate[];
}

function normalizeDiffValue(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizedEventToDiffSlice(event: NormalizedEvent): Record<FingerprintDiffField, string | null> {
  return {
    title: normalizeDiffValue(event.title),
    venueName: normalizeDiffValue(event.venueName),
    startTs: normalizeDiffValue(event.startTs),
    endTs: normalizeDiffValue(event.endTs),
    descriptionText: normalizeDiffValue(event.descriptionText),
    venueAddress: normalizeDiffValue(event.venueAddress),
    venueCity: normalizeDiffValue(event.venueCity),
    ticketUrl: normalizeDiffValue(event.ticketUrl),
    externalUrl: normalizeDiffValue(event.externalUrl),
    category: normalizeDiffValue(event.category)
  };
}

export function diffNormalizedEvents(
  before: NormalizedEvent,
  after: NormalizedEvent
): {
  changedFields: FingerprintDiffField[];
  before: Partial<Record<FingerprintDiffField, string | null>>;
  after: Partial<Record<FingerprintDiffField, string | null>>;
} {
  const beforeSlice = normalizedEventToDiffSlice(before);
  const afterSlice = normalizedEventToDiffSlice(after);
  const changedFields: FingerprintDiffField[] = [];
  const beforeOut: Partial<Record<FingerprintDiffField, string | null>> = {};
  const afterOut: Partial<Record<FingerprintDiffField, string | null>> = {};

  for (const field of FINGERPRINT_DIFF_FIELDS) {
    if (beforeSlice[field] !== afterSlice[field]) {
      changedFields.push(field);
      beforeOut[field] = beforeSlice[field];
      afterOut[field] = afterSlice[field];
    }
  }

  return { changedFields, before: beforeOut, after: afterOut };
}

export function buildNewAuditItem(event: NormalizedEvent): PersistAuditItemNew {
  const externalUrl =
    event.externalUrl?.trim() ||
    (event.sourceEventId.startsWith("http") ? event.sourceEventId.trim() : undefined);

  return {
    source: event.source,
    source_event_id: event.sourceEventId,
    title: event.title,
    start_ts: event.startTs,
    venue_name: event.venueName,
    ...(externalUrl ? { external_url: externalUrl } : {})
  };
}

export function buildChangedAuditItem(before: NormalizedEvent, after: NormalizedEvent): PersistAuditItemChanged {
  const diff = diffNormalizedEvents(before, after);
  return {
    source_event_id: after.sourceEventId,
    title: after.title,
    changed_fields: diff.changedFields,
    before: diff.before,
    after: diff.after
  };
}

export function capAuditItems<T>(items: T[], max = 20): T[] {
  return items.slice(0, max);
}

export function buildPersistAuditSummary(opts: {
  newItems: PersistAuditItemNew[];
  changedItems: PersistAuditItemChanged[];
  unchangedCount: number;
  batchDuplicateItems?: PersistAuditItemBatchDuplicate[];
}): PersistAuditSummary {
  const batchDuplicateItems = opts.batchDuplicateItems ?? [];
  return {
    new: opts.newItems.length,
    changed: opts.changedItems.length,
    unchanged: opts.unchangedCount,
    new_items: opts.newItems,
    changed_items: opts.changedItems,
    ...(batchDuplicateItems.length > 0
      ? {
          batch_duplicates: batchDuplicateItems.length,
          batch_duplicate_items: batchDuplicateItems
        }
      : {})
  };
}

export function truncateForLog(value: string | null | undefined, max = 200): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

export function truncateAuditDiffForLog(
  slice: Partial<Record<FingerprintDiffField, string | null>>
): Partial<Record<FingerprintDiffField, string | null>> {
  const out: Partial<Record<FingerprintDiffField, string | null>> = {};
  for (const [key, value] of Object.entries(slice)) {
    out[key as FingerprintDiffField] = truncateForLog(value);
  }
  return out;
}
