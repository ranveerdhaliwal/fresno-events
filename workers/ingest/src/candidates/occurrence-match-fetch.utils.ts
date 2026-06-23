import type { NormalizedEvent } from "@fresno-events/shared";
import { computeOccurrenceFingerprints, startTsLookupWindow, venueDateLookupKey } from "@fresno-events/shared";

import type {
  OccurrenceMatchCandidate,
  OccurrenceMatchEvent,
  OccurrenceMatchIndex
} from "@/candidates/occurrence-match.types";
import type { SupabaseConfig } from "@/sources";

/** PostgREST GET `in.(...)` — keep each request under proxy URI limits (~64-char hash keys). */
export const OCCURRENCE_IN_FILTER_BATCH_SIZE = 48;

/** Cap ±36h window lookups — each window is one Worker subrequest. */
export const MAX_START_TS_WINDOW_FETCHES = 6;

/** Above this event count, use primary occurrence keys only and skip redundant published-key lookups (Workers free tier: 50 external subrequests). */
export const COMPACT_OCCURRENCE_FETCH_EVENT_THRESHOLD = 40;

/** Max PostgREST `in.(...)` batches per column during compact fetch. */
export const MAX_IN_FILTER_BATCHES_COMPACT = 3;

const START_TS_WINDOW_CANDIDATE_LIMIT = "2000";

const CANDIDATE_SELECT =
  "id,source,source_event_id,title,venue_name,start_ts,status,matched_event_id,occurrence_id,canonical_candidate_id,created_at,occurrence_key,url_key";

function supabaseHeaders(config: SupabaseConfig) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Accept: "application/json"
  };
}

export function chunkValues<T>(values: T[], batchSize: number): T[][] {
  if (values.length === 0 || batchSize <= 0) {
    return [];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += batchSize) {
    chunks.push(values.slice(i, i + batchSize));
  }
  return chunks;
}

export function dedupeStartTsWindows(
  windows: Array<{ from: string; to: string }>
): Array<{ from: string; to: string }> {
  const seen = new Set<string>();
  const unique: Array<{ from: string; to: string }> = [];
  for (const window of windows) {
    const key = `${window.from}|${window.to}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(window);
  }
  return unique;
}

/** Merge overlapping or touching ±36h lookup windows into fewer range queries. */
export function mergeOverlappingStartTsWindows(
  windows: Array<{ from: string; to: string }>
): Array<{ from: string; to: string }> {
  if (windows.length <= 1) {
    return windows;
  }

  const sorted = [...windows].sort((a, b) => a.from.localeCompare(b.from));
  const merged: Array<{ from: string; to: string }> = [];
  let current = { ...sorted[0]! };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!;
    if (next.from <= current.to) {
      if (next.to > current.to) {
        current.to = next.to;
      }
      continue;
    }
    merged.push(current);
    current = { ...next };
  }
  merged.push(current);
  return merged;
}

/** When merged windows still exceed the subrequest budget, split the overall span into coarse chunks. */
export function capStartTsWindows(
  windows: Array<{ from: string; to: string }>,
  maxFetches: number
): Array<{ from: string; to: string }> {
  if (windows.length <= maxFetches || maxFetches <= 0) {
    return windows;
  }
  if (maxFetches === 1) {
    return [
      {
        from: windows[0]!.from,
        to: windows[windows.length - 1]!.to
      }
    ];
  }

  const minMs = Math.min(...windows.map((window) => new Date(window.from).getTime()));
  const maxMs = Math.max(...windows.map((window) => new Date(window.to).getTime()));
  const span = Math.max(maxMs - minMs, 1);
  const chunkMs = Math.ceil(span / maxFetches);

  const capped: Array<{ from: string; to: string }> = [];
  for (let i = 0; i < maxFetches; i++) {
    const fromMs = minMs + i * chunkMs;
    const toMs = i === maxFetches - 1 ? maxMs : minMs + (i + 1) * chunkMs;
    capped.push({
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString()
    });
  }
  return capped;
}

export function compressStartTsWindowsForFetch(
  windows: Array<{ from: string; to: string }>,
  maxFetches = MAX_START_TS_WINDOW_FETCHES
): Array<{ from: string; to: string }> {
  const deduped = dedupeStartTsWindows(windows);
  const merged = mergeOverlappingStartTsWindows(deduped);
  return capStartTsWindows(merged, maxFetches);
}

export function collectOccurrenceKeysForFetch(
  fingerprints: { occurrenceKey: string; occurrenceKeysForLookup: string[] },
  compact: boolean
): string[] {
  if (compact) {
    return fingerprints.occurrenceKey ? [fingerprints.occurrenceKey] : [];
  }
  return fingerprints.occurrenceKeysForLookup;
}

export function capInFilterBatches<T>(values: T[], batchSize: number, maxBatches: number): T[][] {
  const chunks = chunkValues(values, batchSize);
  if (chunks.length <= maxBatches) {
    return chunks;
  }
  return chunks.slice(0, maxBatches);
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function appendToMap<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

export async function buildOccurrenceMatchIndex(
  config: SupabaseConfig,
  events: NormalizedEvent[]
): Promise<OccurrenceMatchIndex> {
  const compactFetch = events.length >= COMPACT_OCCURRENCE_FETCH_EVENT_THRESHOLD;
  const occurrenceKeys = new Set<string>();
  const urlKeys = new Set<string>();
  const startTsWindows: Array<{ from: string; to: string }> = [];

  for (const event of events) {
    const fp = await computeOccurrenceFingerprints(event);
    for (const key of collectOccurrenceKeysForFetch(fp, compactFetch)) {
      occurrenceKeys.add(key);
    }
    if (fp.urlKey) {
      urlKeys.add(fp.urlKey);
    }
    const window = startTsLookupWindow(event.startTs);
    if (window) {
      startTsWindows.push(window);
    }
  }

  if (compactFetch) {
    console.log(
      JSON.stringify({
        event: "ingest_occurrence_fetch_compact",
        events: events.length,
        occurrence_keys: occurrenceKeys.size,
        url_keys: urlKeys.size
      })
    );
  }

  const maxWindowFetches = compactFetch ? 2 : MAX_START_TS_WINDOW_FETCHES;
  const candidates = await fetchCandidatesByKeys(
    config,
    [...occurrenceKeys],
    [...urlKeys],
    startTsWindows,
    {
      maxWindowFetches,
      ...(compactFetch ? { maxInFilterBatches: MAX_IN_FILTER_BATCHES_COMPACT } : {})
    }
  );
  const occurrenceIds = [...new Set(candidates.map((row) => row.occurrence_id).filter(Boolean))];
  const publishedEvents = await fetchPublishedEvents(config, [...occurrenceKeys], occurrenceIds, {
    includeOccurrenceKeyLookup: !compactFetch,
    ...(compactFetch ? { maxInFilterBatches: MAX_IN_FILTER_BATCHES_COMPACT } : {})
  });

  const candidatesByOccurrenceKey = new Map<string, OccurrenceMatchCandidate[]>();
  const candidatesByUrlKey = new Map<string, OccurrenceMatchCandidate[]>();
  const candidatesByVenueDate = new Map<string, OccurrenceMatchCandidate[]>();
  const candidatesByOccurrenceId = new Map<string, OccurrenceMatchCandidate[]>();
  const eventsByOccurrenceKey = new Map<string, OccurrenceMatchEvent[]>();
  const eventsByOccurrenceId = new Map<string, OccurrenceMatchEvent[]>();

  for (const row of candidates) {
    if (row.occurrence_key) {
      appendToMap(candidatesByOccurrenceKey, row.occurrence_key, row);
    }
    if (row.url_key) {
      appendToMap(candidatesByUrlKey, row.url_key, row);
    }
    const venueDateKey = venueDateLookupKey(row.venue_name, row.start_ts);
    if (venueDateKey) {
      appendToMap(candidatesByVenueDate, venueDateKey, row);
    }
    appendToMap(candidatesByOccurrenceId, row.occurrence_id, row);
  }

  for (const row of publishedEvents) {
    if (row.occurrence_key) {
      appendToMap(eventsByOccurrenceKey, row.occurrence_key, row);
    }
    if (row.occurrence_id) {
      appendToMap(eventsByOccurrenceId, row.occurrence_id, row);
    }
  }

  return {
    candidatesByOccurrenceKey,
    candidatesByUrlKey,
    candidatesByVenueDate,
    candidatesByOccurrenceId,
    eventsByOccurrenceKey,
    eventsByOccurrenceId
  };
}

async function fetchCandidatesByKeys(
  config: SupabaseConfig,
  occurrenceKeys: string[],
  urlKeys: string[],
  startTsWindows: Array<{ from: string; to: string }>,
  options?: { maxWindowFetches?: number; maxInFilterBatches?: number }
): Promise<OccurrenceMatchCandidate[]> {
  const maxWindowFetches = options?.maxWindowFetches ?? MAX_START_TS_WINDOW_FETCHES;
  const batchOccurrence = options?.maxInFilterBatches
    ? capInFilterBatches(occurrenceKeys, OCCURRENCE_IN_FILTER_BATCH_SIZE, options.maxInFilterBatches)
    : chunkValues(occurrenceKeys, OCCURRENCE_IN_FILTER_BATCH_SIZE);
  const batchUrl = options?.maxInFilterBatches
    ? capInFilterBatches(urlKeys, OCCURRENCE_IN_FILTER_BATCH_SIZE, options.maxInFilterBatches)
    : chunkValues(urlKeys, OCCURRENCE_IN_FILTER_BATCH_SIZE);

  if (occurrenceKeys.length === 0 && urlKeys.length === 0 && startTsWindows.length === 0) {
    return [];
  }

  const merged: OccurrenceMatchCandidate[] = [];

  for (const batch of batchOccurrence) {
    merged.push(...(await fetchCandidatesInFilter(config, "occurrence_key", batch)));
  }
  for (const batch of batchUrl) {
    merged.push(...(await fetchCandidatesInFilter(config, "url_key", batch)));
  }

  const dedupedWindows = dedupeStartTsWindows(startTsWindows);
  const mergedWindows = mergeOverlappingStartTsWindows(dedupedWindows);
  const compressedWindows = capStartTsWindows(mergedWindows, maxWindowFetches);
  if (startTsWindows.length !== compressedWindows.length) {
    console.log(
      JSON.stringify({
        event: "ingest_occurrence_start_ts_windows_compressed",
        input: startTsWindows.length,
        deduped: dedupedWindows.length,
        merged: mergedWindows.length,
        fetches: compressedWindows.length
      })
    );
  }
  for (const window of compressedWindows) {
    merged.push(...(await fetchCandidatesInStartTsWindow(config, window)));
  }

  return dedupeById(merged);
}

async function fetchCandidatesInFilter(
  config: SupabaseConfig,
  column: "occurrence_key" | "url_key",
  values: string[]
): Promise<OccurrenceMatchCandidate[]> {
  if (values.length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    select: CANDIDATE_SELECT,
    limit: "2000"
  });
  params.set(column, `in.(${values.join(",")})`);

  const response = await fetch(`${config.url}/rest/v1/event_candidates?${params}`, {
    headers: supabaseHeaders(config)
  });

  if (!response.ok) {
    console.log(
      JSON.stringify({
        event: "ingest_occurrence_fetch_candidates_failed",
        status: response.status,
        column,
        batch_size: values.length
      })
    );
    return [];
  }

  return (await response.json()) as OccurrenceMatchCandidate[];
}

async function fetchCandidatesInStartTsWindow(
  config: SupabaseConfig,
  window: { from: string; to: string }
): Promise<OccurrenceMatchCandidate[]> {
  const params = new URLSearchParams({
    select: CANDIDATE_SELECT,
    and: `(start_ts.gte.${window.from},start_ts.lte.${window.to})`,
    status: "in.(awaiting_enrichment,pending_review,needs_changes,approved)",
    limit: START_TS_WINDOW_CANDIDATE_LIMIT
  });

  const response = await fetch(`${config.url}/rest/v1/event_candidates?${params}`, {
    headers: supabaseHeaders(config)
  });

  if (!response.ok) {
    console.log(
      JSON.stringify({
        event: "ingest_occurrence_fetch_candidates_failed",
        status: response.status,
        column: "start_ts_window",
        from: window.from,
        to: window.to
      })
    );
    return [];
  }

  return (await response.json()) as OccurrenceMatchCandidate[];
}

async function fetchPublishedEvents(
  config: SupabaseConfig,
  occurrenceKeys: string[],
  occurrenceIds: string[],
  options?: { includeOccurrenceKeyLookup?: boolean; maxInFilterBatches?: number }
): Promise<OccurrenceMatchEvent[]> {
  if (occurrenceKeys.length === 0 && occurrenceIds.length === 0) {
    return [];
  }

  const merged: OccurrenceMatchEvent[] = [];
  const includeOccurrenceKeyLookup = options?.includeOccurrenceKeyLookup ?? true;
  const batchIds = options?.maxInFilterBatches
    ? capInFilterBatches(occurrenceIds, OCCURRENCE_IN_FILTER_BATCH_SIZE, options.maxInFilterBatches)
    : chunkValues(occurrenceIds, OCCURRENCE_IN_FILTER_BATCH_SIZE);

  if (includeOccurrenceKeyLookup) {
    const batchKeys = options?.maxInFilterBatches
      ? capInFilterBatches(occurrenceKeys, OCCURRENCE_IN_FILTER_BATCH_SIZE, options.maxInFilterBatches)
      : chunkValues(occurrenceKeys, OCCURRENCE_IN_FILTER_BATCH_SIZE);
    for (const batch of batchKeys) {
      merged.push(...(await fetchPublishedEventsInFilter(config, "occurrence_key", batch)));
    }
  }
  for (const batch of batchIds) {
    merged.push(...(await fetchPublishedEventsInFilter(config, "occurrence_id", batch)));
  }

  return dedupeById(merged);
}

async function fetchPublishedEventsInFilter(
  config: SupabaseConfig,
  column: "occurrence_key" | "occurrence_id",
  values: string[]
): Promise<OccurrenceMatchEvent[]> {
  if (values.length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    select: "id,occurrence_id,occurrence_key,status",
    status: "eq.scheduled",
    limit: "500"
  });
  params.set(column, `in.(${values.join(",")})`);

  const response = await fetch(`${config.url}/rest/v1/events?${params}`, {
    headers: supabaseHeaders(config)
  });

  if (!response.ok) {
    console.log(
      JSON.stringify({
        event: "ingest_occurrence_fetch_events_failed",
        status: response.status,
        column,
        batch_size: values.length
      })
    );
    return [];
  }

  return (await response.json()) as OccurrenceMatchEvent[];
}
