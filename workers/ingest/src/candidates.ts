import type { NormalizedEvent, ScrapeResult } from "@fresno-events/shared";

import {
  contentFingerprint,
  fingerprintChanged,
  resolveStatusOnRescrape,
  type ExistingCandidateRow
} from "@/candidates/content-fingerprint.utils";
import type { IngestEnv } from "@/env";
import { getSupabaseConfig, type SupabaseConfig } from "@/sources";

export type PersistenceResult =
  | { persisted: false; reason: string }
  | { persisted: true; candidates: number };

const CANDIDATE_UPSERT_BATCH_SIZE = 40;

export async function persistScrapeResult(env: IngestEnv, result: ScrapeResult): Promise<PersistenceResult> {
  const config = getSupabaseConfig(env);
  const uniqueEvents = dedupeEventsBySourceId(result.events);

  if (!config) {
    return {
      persisted: false,
      reason: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to persist candidates."
    };
  }

  await supabaseRequest(config, "/rest/v1/ingest_runs?on_conflict=id", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({
      id: result.runId,
      source: result.source,
      status: result.errors.length > 0 ? "completed_with_errors" : "completed",
      events_found: uniqueEvents.length,
      errors_count: result.errors.length,
      metrics: result.metrics,
      finished_at: new Date().toISOString()
    })
  });

  if (uniqueEvents.length === 0) {
    return { persisted: true, candidates: 0 };
  }

  const existingByKey = await fetchExistingCandidatesForSource(config, result.source);
  const persistStarted = performance.now();
  let unchanged = 0;
  let changed = 0;
  let publishedSynced = 0;

  console.log(
    JSON.stringify({
      event: "ingest_persist_start",
      source: result.source,
      runId: result.runId,
      candidates: uniqueEvents.length,
      batches: Math.ceil(uniqueEvents.length / CANDIDATE_UPSERT_BATCH_SIZE)
    })
  );

  for (let offset = 0; offset < uniqueEvents.length; offset += CANDIDATE_UPSERT_BATCH_SIZE) {
    const chunk = uniqueEvents.slice(offset, offset + CANDIDATE_UPSERT_BATCH_SIZE);
    const rows: Array<Record<string, unknown>> = [];

    for (const event of chunk) {
      const key = candidateKey(event.source, event.sourceEventId);
      const existing = existingByKey.get(key);
      const fp = await contentFingerprint(event);
      const status = resolveStatusOnRescrape(existing, fp);

      if (existing && !fingerprintChanged(existing, fp)) {
        unchanged += 1;
      } else {
        changed += 1;
      }

      rows.push(await toCandidateRow(result.runId, event, fp, status, existing));

      if (existing?.matched_event_id) {
        const synced = await syncPublishedEvent(config, existing.matched_event_id, event, {
          contentChanged: fingerprintChanged(existing, fp)
        });
        if (synced) {
          publishedSynced += 1;
        }
      }
    }

    await supabaseRequest(config, "/rest/v1/event_candidates?on_conflict=source,source_event_id", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(rows)
    });
  }

  console.log(
    JSON.stringify({
      event: "ingest_persist_end",
      source: result.source,
      runId: result.runId,
      candidates: uniqueEvents.length,
      unchanged,
      changed,
      published_events_synced: publishedSynced,
      duration_ms: Math.round(performance.now() - persistStarted)
    })
  );

  return { persisted: true, candidates: uniqueEvents.length };
}

/** Postgres upsert rejects duplicate (source, source_event_id) in one batch. */
function dedupeEventsBySourceId(events: NormalizedEvent[]): NormalizedEvent[] {
  const byKey = new Map<string, NormalizedEvent>();
  for (const event of events) {
    byKey.set(`${event.source}:${event.sourceEventId}`, event);
  }
  return [...byKey.values()];
}

function candidateKey(source: string, sourceEventId: string) {
  return `${source}:${sourceEventId}`;
}

async function fetchExistingCandidatesForSource(
  config: SupabaseConfig,
  source: string
): Promise<Map<string, ExistingCandidateRow>> {
  const params = new URLSearchParams({
    select:
      "id,source,source_event_id,status,content_fingerprint,matched_event_id,reviewed_at,reviewed_by",
    source: `eq.${source}`,
    limit: "2000"
  });

  const response = await fetch(`${config.url}/rest/v1/event_candidates?${params}`, {
    headers: supabaseHeaders(config)
  });

  if (!response.ok) {
    console.log(
      JSON.stringify({
        event: "ingest_persist_fetch_existing_failed",
        source,
        status: response.status
      })
    );
    return new Map();
  }

  const rows = (await response.json()) as ExistingCandidateRow[];
  const map = new Map<string, ExistingCandidateRow>();
  for (const row of rows) {
    map.set(candidateKey(row.source, row.source_event_id), row);
  }
  return map;
}

async function toCandidateRow(
  runId: string,
  event: NormalizedEvent,
  fingerprint: string,
  status: string,
  existing: ExistingCandidateRow | undefined
) {
  const now = new Date().toISOString();
  return {
    run_id: runId,
    source: event.source,
    source_event_id: event.sourceEventId,
    title: event.title,
    venue_name: event.venueName,
    start_ts: event.startTs,
    source_url: event.externalUrl ?? null,
    ticket_url: event.ticketUrl ?? null,
    normalized_event: event,
    raw_payload: {},
    content_fingerprint: fingerprint,
    dedupe_hash: await legacyDedupeHash(event),
    confidence_score: event.source === "ticketmaster" ? 0.84 : 0.7,
    status,
    updated_at: now,
    ...(existing?.reviewed_at ? { reviewed_at: existing.reviewed_at } : {}),
    ...(existing?.reviewed_by ? { reviewed_by: existing.reviewed_by } : {}),
    ...(existing?.matched_event_id ? { matched_event_id: existing.matched_event_id } : {})
  };
}

/** Legacy dedupe_hash (unique constraint); unchanged algorithm for compatibility. */
async function legacyDedupeHash(event: NormalizedEvent) {
  return sha256Hex(
    [event.source, event.sourceEventId, event.title, event.venueName, event.startTs].join("|").toLowerCase()
  );
}

async function syncPublishedEvent(
  config: SupabaseConfig,
  eventId: string,
  normalized: NormalizedEvent,
  opts: { contentChanged: boolean }
): Promise<boolean> {
  const now = new Date().toISOString();
  const body: Record<string, unknown> = {
    last_seen_at: now,
    updated_at: now
  };

  if (opts.contentChanged) {
    body.title = normalized.title;
    body.start_ts = normalized.startTs;
    body.description_text = normalized.descriptionText ?? null;
    body.description_html = normalized.descriptionHtml ?? null;
    body.external_url = normalized.externalUrl ?? null;
    body.ticket_url = normalized.ticketUrl ?? null;
    if (normalized.endTs) {
      body.end_ts = normalized.endTs;
    }
    if (normalized.category) {
      body.category = normalized.category;
    }
  }

  const response = await fetch(`${config.url}/rest/v1/events?id=eq.${eventId}`, {
    method: "PATCH",
    headers: {
      ...supabaseHeaders(config),
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    console.log(
      JSON.stringify({
        event: "ingest_published_event_sync_failed",
        eventId,
        status: response.status
      })
    );
    return false;
  }

  return true;
}

async function sha256Hex(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function supabaseHeaders(config: SupabaseConfig) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    Accept: "application/json"
  };
}

async function supabaseRequest(config: SupabaseConfig, path: string, init: RequestInit) {
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      ...supabaseHeaders(config),
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase candidate persistence failed with ${response.status}: ${await response.text()}`);
  }
}
