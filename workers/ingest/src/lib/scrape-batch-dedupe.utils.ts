import type { NormalizedEvent } from "@fresno-events/shared";
import {
  computeLooseOccurrenceKey,
  computeOccurrenceFingerprints,
  computeOccurrenceKey
} from "@fresno-events/shared";

import type { PersistAuditItemBatchDuplicate } from "@/candidates/persist-audit.utils";

export type BatchDuplicateMatch = PersistAuditItemBatchDuplicate["match"];

interface KeptEntry {
  event: NormalizedEvent;
  keys: Set<string>;
}

export interface ScrapeBatchDedupeResult {
  events: NormalizedEvent[];
  removed: number;
  duplicates: PersistAuditItemBatchDuplicate[];
}

function dedupeBySourceEventId(events: NormalizedEvent[]): NormalizedEvent[] {
  const byKey = new Map<string, NormalizedEvent>();
  for (const event of events) {
    byKey.set(`${event.source}:${event.sourceEventId}`, event);
  }
  return [...byKey.values()];
}

function resolveExternalUrl(event: NormalizedEvent): string | undefined {
  const url = event.externalUrl?.trim() || (event.ticketUrl?.trim() ?? "");
  return url.startsWith("http") ? url : undefined;
}

function isBetterPrimary(candidate: NormalizedEvent, current: NormalizedEvent): boolean {
  if (candidate.seriesId && !current.seriesId) {
    return true;
  }
  if (!candidate.seriesId && current.seriesId) {
    return false;
  }
  // Visit Fresno (and similar CMS): prefer the occurrence-facing listing ("Presented By")
  // over the multi-year master page when both appear for the same calendar night.
  const candidatePresented = Boolean(candidate.seriesPresentedBy?.trim());
  const currentPresented = Boolean(current.seriesPresentedBy?.trim());
  if (candidatePresented && !currentPresented) {
    return true;
  }
  if (!candidatePresented && currentPresented) {
    return false;
  }
  if (candidate.title.length !== current.title.length) {
    return candidate.title.length > current.title.length;
  }
  return candidate.sourceEventId.localeCompare(current.sourceEventId) < 0;
}

function buildDuplicateItem(
  dropped: NormalizedEvent,
  kept: NormalizedEvent,
  match: BatchDuplicateMatch
): PersistAuditItemBatchDuplicate {
  const externalUrl = resolveExternalUrl(dropped);
  const keptExternalUrl = resolveExternalUrl(kept);
  return {
    title: dropped.title,
    start_ts: dropped.startTs,
    venue_name: dropped.venueName,
    source: dropped.source,
    source_event_id: dropped.sourceEventId,
    kept_source_event_id: kept.sourceEventId,
    kept_title: kept.title,
    match,
    ...(externalUrl ? { external_url: externalUrl } : {}),
    ...(keptExternalUrl ? { kept_external_url: keptExternalUrl } : {})
  };
}

function detectMatch(
  keys: { occurrenceKey: string | null; looseKey: string | null },
  entry: KeptEntry
): BatchDuplicateMatch | null {
  // Same-night only — url_key is for cross-source dedupe, not within-batch collapse.
  if (keys.occurrenceKey && entry.keys.has(keys.occurrenceKey)) {
    return "occurrence_key";
  }
  if (keys.looseKey && entry.keys.has(keys.looseKey)) {
    return "loose_title";
  }
  return null;
}

async function fingerprintKeys(event: NormalizedEvent): Promise<{
  occurrenceKey: string | null;
  looseKey: string | null;
  all: string[];
}> {
  const fp = await computeOccurrenceFingerprints(event);
  const occurrenceKey =
    fp.occurrenceKey ||
    (await computeOccurrenceKey(event.title, event.startTs, event.venueName));
  const looseKey = await computeLooseOccurrenceKey(event.title, event.startTs, event.venueName);
  const all = [occurrenceKey, looseKey].filter((key): key is string => Boolean(key));
  return { occurrenceKey, looseKey, all };
}

/** Collapse accidental within-batch duplicates before validation/persist (all scrapers). */
export async function dedupeScrapeBatch(events: NormalizedEvent[]): Promise<ScrapeBatchDedupeResult> {
  const uniqueBySource = dedupeBySourceEventId(events);
  const kept: KeptEntry[] = [];
  const duplicates: PersistAuditItemBatchDuplicate[] = [];

  for (const event of uniqueBySource) {
    const keys = await fingerprintKeys(event);
    const keySet = new Set(keys.all);

    let matched: { entry: KeptEntry; match: BatchDuplicateMatch } | null = null;
    for (const entry of kept) {
      const match = detectMatch(keys, entry);
      if (match) {
        matched = { entry, match };
        break;
      }
    }

    if (!matched) {
      kept.push({ event, keys: keySet });
      continue;
    }

    const { entry, match } = matched;
    if (isBetterPrimary(event, entry.event)) {
      duplicates.push(buildDuplicateItem(entry.event, event, match));
      entry.event = event;
      for (const key of keySet) {
        entry.keys.add(key);
      }
    } else {
      duplicates.push(buildDuplicateItem(event, entry.event, match));
      for (const key of keySet) {
        entry.keys.add(key);
      }
    }
  }

  return {
    events: kept.map((entry) => entry.event),
    removed: duplicates.length,
    duplicates
  };
}
