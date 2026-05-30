import type { NormalizedEvent } from "@fresno-events/shared";
import { computeOccurrenceFingerprints } from "@fresno-events/shared";

import type {
  OccurrenceMatchCandidate,
  OccurrenceMatchEvent,
  OccurrenceMatchIndex
} from "@/candidates/occurrence-match.types";
import type { SupabaseConfig } from "@/sources";

function supabaseHeaders(config: SupabaseConfig) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Accept: "application/json"
  };
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

  for (const event of events) {
    const fp = await computeOccurrenceFingerprints(event);
    for (const key of fp.occurrenceKeysForLookup) {
      occurrenceKeys.add(key);
    }
    if (fp.urlKey) {
      urlKeys.add(fp.urlKey);
    }
  }

  const candidates = await fetchCandidatesByKeys(config, [...occurrenceKeys], [...urlKeys]);
  const occurrenceIds = [...new Set(candidates.map((row) => row.occurrence_id).filter(Boolean))];
  const publishedEvents = await fetchPublishedEvents(config, [...occurrenceKeys], occurrenceIds);

  const candidatesByOccurrenceKey = new Map<string, OccurrenceMatchCandidate[]>();
  const candidatesByUrlKey = new Map<string, OccurrenceMatchCandidate[]>();
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
    candidatesByOccurrenceId,
    eventsByOccurrenceKey,
    eventsByOccurrenceId
  };
}

async function fetchCandidatesByKeys(
  config: SupabaseConfig,
  occurrenceKeys: string[],
  urlKeys: string[]
): Promise<OccurrenceMatchCandidate[]> {
  if (occurrenceKeys.length === 0 && urlKeys.length === 0) {
    return [];
  }

  const filters: string[] = [];
  if (occurrenceKeys.length > 0) {
    filters.push(`occurrence_key.in.(${occurrenceKeys.join(",")})`);
  }
  if (urlKeys.length > 0) {
    filters.push(`url_key.in.(${urlKeys.join(",")})`);
  }

  const params = new URLSearchParams({
    select:
      "id,source,source_event_id,status,matched_event_id,occurrence_id,canonical_candidate_id,created_at,occurrence_key,url_key",
    or: `(${filters.join(",")})`,
    limit: "2000"
  });

  const response = await fetch(`${config.url}/rest/v1/event_candidates?${params}`, {
    headers: supabaseHeaders(config)
  });

  if (!response.ok) {
    console.log(
      JSON.stringify({
        event: "ingest_occurrence_fetch_candidates_failed",
        status: response.status
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
  const filters: string[] = [];
  if (occurrenceKeys.length > 0) {
    filters.push(`occurrence_key.in.(${occurrenceKeys.join(",")})`);
  }
  if (occurrenceIds.length > 0) {
    filters.push(`occurrence_id.in.(${occurrenceIds.join(",")})`);
  }

  if (filters.length === 0) {
    return [];
  }

  const params = new URLSearchParams({
    select: "id,occurrence_id,occurrence_key,status",
    or: `(${filters.join(",")})`,
    status: "eq.scheduled",
    limit: "500"
  });

  const response = await fetch(`${config.url}/rest/v1/events?${params}`, {
    headers: supabaseHeaders(config)
  });

  if (!response.ok) {
    console.log(
      JSON.stringify({
        event: "ingest_occurrence_fetch_events_failed",
        status: response.status
      })
    );
    return [];
  }

  return (await response.json()) as OccurrenceMatchEvent[];
}
