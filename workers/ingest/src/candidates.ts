import type { EventSource, NormalizedEvent, ScrapeResult } from "@fresno-events/shared";

import {
  type ExistingCandidateRow
} from "@/candidates/content-fingerprint.utils";
import { buildOccurrenceMatchIndex } from "@/candidates/occurrence-match-fetch.utils";
import { resolveOccurrenceForPersist, type OccurrencePersistFields } from "@/candidates/occurrence-resolve.utils";
import { analyzeEventsForPersist } from "@/candidates/persist-analysis.utils";
import {
  buildPersistAuditSummary,
  truncateAuditDiffForLog,
  type PersistAuditItemChanged,
  type PersistAuditItemNew,
  type PersistAuditSummary
} from "@/candidates/persist-audit.utils";
import { buildPublishedEventPatchBody } from "@/candidates/sync-published-event.utils";
import type { IngestEnv } from "@/env";
import { getSupabaseConfig, type SupabaseConfig } from "@/sources";

export type PersistenceResult =
  | { persisted: false; reason: string }
  | { persisted: true; candidates: number };

export type { PersistAuditSummary };

const CANDIDATE_UPSERT_BATCH_SIZE = 40;

export async function previewPersistScrapeResult(
  env: IngestEnv,
  result: ScrapeResult
): Promise<PersistAuditSummary | null> {
  const config = getSupabaseConfig(env);
  const uniqueEvents = dedupeEventsBySourceId(result.events);

  if (!config) {
    return null;
  }

  if (uniqueEvents.length === 0) {
    return buildPersistAuditSummary({ newItems: [], changedItems: [], unchangedCount: 0 });
  }

  const existingByKey = await fetchExistingCandidatesForEvents(config, uniqueEvents);
  const { summary } = await analyzeEventsForPersist(uniqueEvents, existingByKey);
  return summary;
}

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

  const existingByKey = await fetchExistingCandidatesForEvents(config, uniqueEvents);
  const matchIndex = await buildOccurrenceMatchIndex(config, uniqueEvents);
  const crossSourceDedupe = isCrossSourceDedupeEnabled(env);
  const persistStarted = performance.now();
  let publishedSynced = 0;
  const auditNew: PersistAuditItemNew[] = [];
  const auditChanged: PersistAuditItemChanged[] = [];
  let unchanged = 0;

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
    const { analyses } = await analyzeEventsForPersist(chunk, existingByKey);
    const rows: Array<Record<string, unknown>> = [];

    for (const analysis of analyses) {
      const { event, existing, fingerprint, status, contentChanged, auditKind, auditNew: newItem, auditChanged: changedItem } =
        analysis;

      if (auditKind === "new" && newItem) {
        auditNew.push(newItem);
        console.log(
          JSON.stringify({
            event: "ingest_candidate_new",
            run_id: result.runId,
            source: event.source,
            source_event_id: event.sourceEventId,
            title: event.title,
            start_ts: event.startTs,
            venue_name: event.venueName
          })
        );
      } else if (auditKind === "changed" && changedItem) {
        auditChanged.push(changedItem);
        console.log(
          JSON.stringify({
            event: "ingest_candidate_changed",
            run_id: result.runId,
            source: event.source,
            source_event_id: event.sourceEventId,
            title: event.title,
            changed_fields: changedItem.changed_fields,
            before: truncateAuditDiffForLog(changedItem.before),
            after: truncateAuditDiffForLog(changedItem.after)
          })
        );
      } else if (auditKind === "unchanged") {
        unchanged += 1;
      }

      const occurrence = await resolveOccurrenceForPersist({
        event,
        existingId: existing?.id,
        existingOccurrenceId: existing?.occurrence_id ?? null,
        existingStatus: existing?.status,
        existingMatchedEventId: existing?.matched_event_id ?? null,
        existingCanonicalCandidateId: existing?.canonical_candidate_id ?? null,
        baseStatus: status,
        crossSourceDedupe,
        matchIndex
      });

      const rowStatus = occurrence.statusOverride ?? status;
      rows.push(
        await toCandidateRow(
          result.runId,
          event,
          fingerprint,
          rowStatus,
          existing,
          contentChanged,
          occurrence
        )
      );

      const syncEventId = occurrence.matchedEventId ?? existing?.matched_event_id ?? null;
      if (syncEventId) {
        const synced = await syncPublishedEvent(config, syncEventId, event, {
          contentChanged,
          applyContentPatch: false
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

  const auditSummary = buildPersistAuditSummary({
    newItems: auditNew,
    changedItems: auditChanged,
    unchangedCount: unchanged
  });

  console.log(
    JSON.stringify({
      event: "ingest_persist_summary",
      run_id: result.runId,
      source: result.source,
      new: auditSummary.new,
      changed: auditSummary.changed,
      unchanged: auditSummary.unchanged,
      new_items: auditSummary.new_items,
      changed_items: auditSummary.changed_items
    })
  );
  console.log(
    `[ingest] persist: +${auditSummary.new} new, ~${auditSummary.changed} changed, =${auditSummary.unchanged} unchanged`
  );

  await patchIngestRunAuditMetrics(config, result.runId, result.metrics ?? {}, auditSummary);

  console.log(
    JSON.stringify({
      event: "ingest_persist_end",
      source: result.source,
      runId: result.runId,
      candidates: uniqueEvents.length,
      unchanged,
      changed: auditSummary.new + auditSummary.changed,
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

function parseNormalizedEvent(row: ExistingCandidateRowRaw): NormalizedEvent {
  const raw = row.normalized_event;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as NormalizedEvent;
  }
  return {
    source: row.source as EventSource,
    sourceEventId: row.source_event_id,
    title: row.title,
    venueName: row.venue_name,
    startTs: row.start_ts,
    category: "community"
  };
}

interface ExistingCandidateRowRaw {
  id: string;
  source: string;
  source_event_id: string;
  status: ExistingCandidateRow["status"];
  content_fingerprint: string | null;
  matched_event_id: string | null;
  occurrence_id: string | null;
  canonical_candidate_id: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  title: string;
  start_ts: string;
  venue_name: string;
  normalized_event: unknown;
}

async function fetchExistingCandidatesForEvents(
  config: SupabaseConfig,
  events: NormalizedEvent[]
): Promise<Map<string, ExistingCandidateRow>> {
  const sources = [...new Set(events.map((event) => event.source))];
  const merged = new Map<string, ExistingCandidateRow>();

  for (const source of sources) {
    const batch = await fetchExistingCandidatesForSource(config, source);
    for (const [key, row] of batch) {
      merged.set(key, row);
    }
  }

  return merged;
}

async function fetchExistingCandidatesForSource(
  config: SupabaseConfig,
  source: string
): Promise<Map<string, ExistingCandidateRow>> {
  const params = new URLSearchParams({
    select:
      "id,source,source_event_id,status,content_fingerprint,matched_event_id,occurrence_id,canonical_candidate_id,reviewed_at,reviewed_by,review_notes,title,start_ts,venue_name,normalized_event",
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

  const rows = (await response.json()) as ExistingCandidateRowRaw[];
  const map = new Map<string, ExistingCandidateRow>();
  for (const row of rows) {
    map.set(candidateKey(row.source, row.source_event_id), {
      ...row,
      normalized_event: parseNormalizedEvent(row)
    });
  }
  return map;
}

async function toCandidateRow(
  runId: string,
  event: NormalizedEvent,
  fingerprint: string,
  status: string,
  existing: ExistingCandidateRow | undefined,
  contentChanged: boolean,
  occurrence: OccurrencePersistFields
) {
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
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
    occurrence_id: occurrence.occurrenceId,
    occurrence_key: occurrence.occurrenceKey,
    url_key: occurrence.urlKey,
    canonical_candidate_id: occurrence.canonicalCandidateId,
    updated_at: now,
    reviewed_at: existing?.reviewed_at ?? null,
    reviewed_by: existing?.reviewed_by ?? null,
    matched_event_id: occurrence.matchedEventId ?? existing?.matched_event_id ?? null,
    review_notes: contentChanged && existing ? null : (existing?.review_notes ?? null)
  };

  return row;
}

function isCrossSourceDedupeEnabled(env: IngestEnv) {
  const value = env.INGEST_CROSS_SOURCE_DEDUPE?.trim().toLowerCase();
  return value === "true" || value === "1";
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
  opts: { contentChanged: boolean; applyContentPatch: boolean }
): Promise<boolean> {
  const now = new Date().toISOString();
  const body = buildPublishedEventPatchBody(normalized, opts, now);

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

async function patchIngestRunAuditMetrics(
  config: SupabaseConfig,
  runId: string,
  scrapeMetrics: Record<string, unknown>,
  audit: ReturnType<typeof buildPersistAuditSummary>
) {
  try {
    const response = await fetch(`${config.url}/rest/v1/ingest_runs?id=eq.${runId}`, {
      method: "PATCH",
      headers: {
        ...supabaseHeaders(config),
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        metrics: {
          ...scrapeMetrics,
          audit
        }
      })
    });

    if (!response.ok) {
      console.log(
        JSON.stringify({
          event: "ingest_run_metrics_patch_failed",
          run_id: runId,
          status: response.status
        })
      );
    }
  } catch (error) {
    console.log(
      JSON.stringify({
        event: "ingest_run_metrics_patch_failed",
        run_id: runId,
        message: error instanceof Error ? error.message : String(error)
      })
    );
  }
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
