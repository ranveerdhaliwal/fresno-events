import type { EventSource, NormalizedEvent, ScrapeResult } from "@fresno-events/shared";

import { buildCandidateUpsertRow } from "@/candidates/candidate-upsert.utils";
import {
  harmonizeLinkedOccurrencePricingBatch
} from "@/candidates/linked-price-harmonize.utils";
import {
  type ExistingCandidateRow
} from "@/candidates/content-fingerprint.utils";
import {
  buildOccurrenceMatchIndex,
  COMPACT_OCCURRENCE_FETCH_EVENT_THRESHOLD
} from "@/candidates/occurrence-match-fetch.utils";
import { resolveOccurrenceForPersist } from "@/candidates/occurrence-resolve.utils";
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
import { compactPersistAuditForLog } from "@/log-compact.utils";
import { filterUpcomingIngestEvents } from "@/lib/upcoming-events.utils";
import { getSupabaseConfig, type SupabaseConfig } from "@/sources";
import { visitFresnoPersistAliasKey } from "@/scrapers/visit-fresno-source-id.utils";

export type PersistenceResult =
  | { persisted: false; reason: string }
  | { persisted: true; candidates: number; audit?: PersistAuditSummary };

export type { PersistAuditSummary };

const CANDIDATE_UPSERT_BATCH_SIZE = 40;
const MAX_PRICE_HARMONIZE_OCCURRENCES_COMPACT = 5;

function capOccurrenceIdsForPriceHarmonize(eventCount: number, occurrenceIds: string[]): string[] {
  if (eventCount < COMPACT_OCCURRENCE_FETCH_EVENT_THRESHOLD) {
    return occurrenceIds;
  }
  return occurrenceIds.slice(0, MAX_PRICE_HARMONIZE_OCCURRENCES_COMPACT);
}

export async function previewPersistScrapeResult(
  env: IngestEnv,
  result: ScrapeResult
): Promise<PersistAuditSummary | null> {
  const config = getSupabaseConfig(env);
  const uniqueEvents = prepareEventsForPersist(result.events, result.runId);

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
  const uniqueEvents = prepareEventsForPersist(result.events, result.runId);

  if (!config) {
    return {
      persisted: false,
      reason: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to persist candidates."
    };
  }

  const validEvents: NormalizedEvent[] = [];
  let invalidEvents = 0;
  for (const event of uniqueEvents) {
    const titleOk = typeof event.title === "string" && event.title.trim().length > 0;
    const venueOk = typeof event.venueName === "string" && event.venueName.trim().length > 0;
    const startOk = typeof event.startTs === "string" && event.startTs.trim().length > 0;
    const sourceOk = typeof event.source === "string" && event.source.trim().length > 0;
    const idOk = typeof event.sourceEventId === "string" && event.sourceEventId.trim().length > 0;

    if (!titleOk || !venueOk || !startOk || !sourceOk || !idOk) {
      invalidEvents += 1;
      console.log(
        JSON.stringify({
          event: "ingest_event_invalid",
          run_id: result.runId,
          source: event.source,
          source_event_id: event.sourceEventId,
          title: typeof event.title === "string" ? event.title : null,
          venue_name: typeof event.venueName === "string" ? event.venueName : null,
          start_ts: typeof event.startTs === "string" ? event.startTs : null
        })
      );
      continue;
    }

    validEvents.push(event);
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
      events_found: validEvents.length,
      errors_count: result.errors.length,
      metrics: result.metrics,
      finished_at: new Date().toISOString()
    })
  });

  if (validEvents.length === 0) {
    if (invalidEvents > 0) {
      console.log(
        JSON.stringify({
          event: "ingest_persist_skipped_invalid_events",
          run_id: result.runId,
          source: result.source,
          invalid_events: invalidEvents
        })
      );
    }
    return {
      persisted: true,
      candidates: 0,
      audit: buildPersistAuditSummary({ newItems: [], changedItems: [], unchangedCount: 0 })
    };
  }

  const existingByKey = await fetchExistingCandidatesForEvents(config, validEvents);
  const matchIndex = await buildOccurrenceMatchIndex(config, validEvents);
  const crossSourceDedupe = isCrossSourceDedupeEnabled(env);
  const skipPublishedEventSync = validEvents.length >= COMPACT_OCCURRENCE_FETCH_EVENT_THRESHOLD;
  const persistStarted = performance.now();
  let publishedSynced = 0;
  const auditNew: PersistAuditItemNew[] = [];
  const auditChanged: PersistAuditItemChanged[] = [];
  let unchanged = 0;
  const occurrenceIdsForPricing = new Set<string>();

  console.log(
    JSON.stringify({
      event: "ingest_persist_start",
      source: result.source,
      runId: result.runId,
      candidates: validEvents.length,
      invalid_events: invalidEvents,
      batches: Math.ceil(validEvents.length / CANDIDATE_UPSERT_BATCH_SIZE),
      skip_published_event_sync: skipPublishedEventSync
    })
  );

  for (let offset = 0; offset < validEvents.length; offset += CANDIDATE_UPSERT_BATCH_SIZE) {
    const chunk = validEvents.slice(offset, offset + CANDIDATE_UPSERT_BATCH_SIZE);
    const { analyses } = await analyzeEventsForPersist(chunk, existingByKey);
    const rows: Array<Record<string, unknown>> = [];
    const migrationRows: Array<Record<string, unknown>> = [];

    for (const analysis of analyses) {
      const { event, existing, fingerprint, status, contentChanged, auditKind, auditNew: newItem, auditChanged: changedItem, ingestExclusion } =
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
        ...(existing?.id ? { existingId: existing.id } : {}),
        existingOccurrenceId: existing?.occurrence_id ?? null,
        ...(existing?.status ? { existingStatus: existing.status } : {}),
        existingMatchedEventId: existing?.matched_event_id ?? null,
        existingCanonicalCandidateId: existing?.canonical_candidate_id ?? null,
        baseStatus: status,
        crossSourceDedupe,
        matchIndex
      });

      const rowStatus = occurrence.statusOverride ?? status;
      const upsertRow = await buildCandidateUpsertRow({
        auditKind,
        runId: result.runId,
        event,
        fingerprint,
        status: rowStatus,
        ...(existing ? { existing } : {}),
        contentChanged,
        occurrence,
        ...(ingestExclusion ? { ingestExclusion } : {})
      });

      if (existing && existing.source_event_id !== event.sourceEventId) {
        migrationRows.push({ ...upsertRow, id: existing.id });
      } else {
        rows.push(upsertRow);
      }

      if (occurrence.occurrenceId) {
        occurrenceIdsForPricing.add(occurrence.occurrenceId);
      }

      const syncEventId = occurrence.matchedEventId ?? existing?.matched_event_id ?? null;
      if (syncEventId && !skipPublishedEventSync) {
        const synced = await syncPublishedEvent(config, syncEventId, event, {
          contentChanged,
          applyContentPatch: false
        });
        if (synced) {
          publishedSynced += 1;
        }
      }
    }

    // Debug: if Supabase rejects the upsert, we need to know whether the payload
    // included required NOT NULL fields (title, venue_name, start_ts, normalized_event).
    for (const row of rows) {
      const source = typeof row.source === "string" ? row.source : null;
      const sourceEventId = typeof row.source_event_id === "string" ? row.source_event_id : null;
      const titleOk = typeof row.title === "string" && row.title.trim().length > 0;
      const venueOk = typeof row.venue_name === "string" && row.venue_name.trim().length > 0;
      const startOk = typeof row.start_ts === "string" && row.start_ts.trim().length > 0;
      const normalizedOk = row.normalized_event !== null && row.normalized_event !== undefined;

      if (!titleOk || !venueOk || !startOk || !normalizedOk) {
        console.log(
          JSON.stringify({
            event: "ingest_candidate_upsert_row_invalid",
            run_id: result.runId,
            source,
            source_event_id: sourceEventId,
            has_title: titleOk,
            has_venue_name: venueOk,
            has_start_ts: startOk,
            has_normalized_event: normalizedOk,
            row_keys: Object.keys(row).sort()
          })
        );
      }
    }

    for (const row of migrationRows) {
      const id = row.id;
      if (typeof id !== "string") {
        continue;
      }
      const { id: _omit, ...patch } = row;
      await supabaseRequest(config, `/rest/v1/event_candidates?id=eq.${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(patch)
      });
    }

    if (rows.length > 0) {
      await supabaseRequest(config, "/rest/v1/event_candidates?on_conflict=source,source_event_id", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify(rows)
      });
    }
  }

  const auditSummary = buildPersistAuditSummary({
    newItems: auditNew,
    changedItems: auditChanged,
    unchangedCount: unchanged
  });

  const priceHarmonize = await harmonizeLinkedOccurrencePricingBatch(
    config,
    capOccurrenceIdsForPriceHarmonize(validEvents.length, [...occurrenceIdsForPricing])
  );
  if (priceHarmonize.rowsUpdated > 0) {
    console.log(
      JSON.stringify({
        event: "ingest_linked_price_harmonize",
        run_id: result.runId,
        source: result.source,
        occurrences: priceHarmonize.occurrences,
        rows_updated: priceHarmonize.rowsUpdated
      })
    );
  }

  console.log(
    JSON.stringify({
      event: "ingest_persist_summary",
      run_id: result.runId,
      source: result.source,
      ...compactPersistAuditForLog(auditSummary)
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
      candidates: validEvents.length,
      invalid_events: invalidEvents,
      unchanged,
      changed: auditSummary.new + auditSummary.changed,
      published_events_synced: publishedSynced,
      duration_ms: Math.round(performance.now() - persistStarted)
    })
  );

  return { persisted: true, candidates: validEvents.length, audit: auditSummary };
}

/** Postgres upsert rejects duplicate (source, source_event_id) in one batch. */
function prepareEventsForPersist(events: NormalizedEvent[], runId: string, now = new Date()): NormalizedEvent[] {
  const unique = dedupeEventsBySourceId(events);
  const upcoming = filterUpcomingIngestEvents(unique, now);
  const skippedPast = unique.length - upcoming.length;
  if (skippedPast > 0) {
    console.log(
      JSON.stringify({
        event: "ingest_skip_past_events",
        run_id: runId,
        skipped: skippedPast
      })
    );
  }
  return upcoming;
}

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
  confidence_score: number;
  raw_payload: Record<string, unknown> | null;
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
  eventbrite_detail_status?: string | null;
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
      "id,source,source_event_id,status,content_fingerprint,confidence_score,raw_payload,matched_event_id,occurrence_id,canonical_candidate_id,reviewed_at,reviewed_by,review_notes,title,start_ts,venue_name,normalized_event,eventbrite_detail_status",
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
    const parsed: ExistingCandidateRow = {
      ...row,
      confidence_score: row.confidence_score ?? 0.7,
      raw_payload: row.raw_payload ?? {},
      normalized_event: parseNormalizedEvent(row)
    };
    map.set(candidateKey(row.source, row.source_event_id), parsed);

    const alias = visitFresnoPersistAliasKey(parsed.normalized_event);
    if (alias) {
      map.set(alias, parsed);
    }
  }
  return map;
}

function isCrossSourceDedupeEnabled(env: IngestEnv) {
  const value = env.INGEST_CROSS_SOURCE_DEDUPE?.trim().toLowerCase();
  if (value === "false" || value === "0" || value === "off") {
    return false;
  }
  return true;
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
