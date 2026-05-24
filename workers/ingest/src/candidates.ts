import type { NormalizedEvent, ScrapeResult } from "@fresno-events/shared";

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

  const persistStarted = performance.now();
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
    const rows = await Promise.all(chunk.map((event) => toCandidateRow(result.runId, event)));

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

async function toCandidateRow(runId: string, event: NormalizedEvent) {
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
    dedupe_hash: await sha256Hex(
      [event.source, event.sourceEventId, event.title, event.venueName, event.startTs].join("|").toLowerCase()
    ),
    confidence_score: event.source === "ticketmaster" ? 0.84 : 0.7,
    status: "pending_review",
    updated_at: new Date().toISOString()
  };
}

async function sha256Hex(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function supabaseRequest(config: SupabaseConfig, path: string, init: RequestInit) {
  const response = await fetch(`${config.url}${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      Accept: "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase candidate persistence failed with ${response.status}: ${await response.text()}`);
  }
}
