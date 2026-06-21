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
  const occurrenceKeys = new Set<string>();
  const urlKeys = new Set<string>();
  const venueDateKeys = new Set<string>();
  const startTsWindows: Array<{ from: string; to: string }> = [];

  for (const event of events) {
    const fp = await computeOccurrenceFingerprints(event);
    for (const key of fp.occurrenceKeysForLookup) {
      occurrenceKeys.add(key);
    }
    if (fp.urlKey) {
      urlKeys.add(fp.urlKey);
    }
    const venueDateKey = venueDateLookupKey(event.venueName, event.startTs);
    if (venueDateKey) {
      venueDateKeys.add(venueDateKey);
    }
    const window = startTsLookupWindow(event.startTs);
    if (window) {
      startTsWindows.push(window);
    }
  }

  const candidates = await fetchCandidatesByKeys(
    config,
    [...occurrenceKeys],
    [...urlKeys],
    startTsWindows
  );
  const occurrenceIds = [...new Set(candidates.map((row) => row.occurrence_id).filter(Boolean))];
  const publishedEvents = await fetchPublishedEvents(config, [...occurrenceKeys], occurrenceIds);

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
  startTsWindows: Array<{ from: string; to: string }>
): Promise<OccurrenceMatchCandidate[]> {
  if (occurrenceKeys.length === 0 && urlKeys.length === 0 && startTsWindows.length === 0) {
    return [];
  }

  const merged: OccurrenceMatchCandidate[] = [];

  for (const batch of chunkValues(occurrenceKeys, OCCURRENCE_IN_FILTER_BATCH_SIZE)) {
    merged.push(...(await fetchCandidatesInFilter(config, "occurrence_key", batch)));
  }
  for (const batch of chunkValues(urlKeys, OCCURRENCE_IN_FILTER_BATCH_SIZE)) {
    merged.push(...(await fetchCandidatesInFilter(config, "url_key", batch)));
  }
  for (const window of startTsWindows) {
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
    limit: "400"
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
  occurrenceIds: string[]
): Promise<OccurrenceMatchEvent[]> {
  if (occurrenceKeys.length === 0 && occurrenceIds.length === 0) {
    return [];
  }

  const merged: OccurrenceMatchEvent[] = [];

  for (const batch of chunkValues(occurrenceKeys, OCCURRENCE_IN_FILTER_BATCH_SIZE)) {
    merged.push(...(await fetchPublishedEventsInFilter(config, "occurrence_key", batch)));
  }
  for (const batch of chunkValues(occurrenceIds, OCCURRENCE_IN_FILTER_BATCH_SIZE)) {
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
