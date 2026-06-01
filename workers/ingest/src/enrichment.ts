import type { NormalizedEvent } from "@fresno-events/shared";

import { enrichCandidate, getAiBackend } from "@/ai";
import {
  candidateNeedsEnrichment,
  formatEnrichmentDoneLine,
  hasAiEnrichmentNotes,
  reasoningPreview,
  summarizeEnrichmentDelta,
  type EnrichmentCandidateRow
} from "@/candidates/enrichment-candidate.utils";
import type { IngestEnv } from "@/env";
import type { SupabaseConfig } from "@/sources";

export interface EnrichmentSummary {
  processed: number;
  updated: number;
  auto_rejected: number;
  errors: number;
  skipped_sufficient_data: number;
  skipped_no_backend: boolean;
  batches: number;
}

export interface EnrichRecentCandidatesOptions {
  dryRun?: boolean;
  /** Filter by event_candidates.source (e.g. api:visitfresnocounty). */
  sourceFilter?: string;
  /** Max rows per batch request (default from MAX_ENRICH_PER_RUN). */
  limit?: number;
  /** When true (default for post-promote), loop batches until queue empty. */
  enrichAll?: boolean;
}

export interface PendingEnrichmentCounts {
  pending_review: number;
  needs_changes: number;
  awaiting_enrichment: number;
  already_enriched: number;
}

function structLogEnabled(env: IngestEnv): boolean {
  return env.INGEST_STRUCT_LOG === "1";
}

function logPhase(env: IngestEnv, message: string, payload: Record<string, unknown> = {}) {
  console.log(`[ingest] ${message}`);
  if (structLogEnabled(env)) {
    console.log(
      JSON.stringify({
        event: "ingest_phase",
        phase: message,
        ...payload
      })
    );
  }
}

function logStruct(env: IngestEnv, event: string, payload: Record<string, unknown>) {
  if (structLogEnabled(env)) {
    console.log(JSON.stringify({ event, ...payload }));
  }
}

export async function countPendingEnrichment(
  supabase: SupabaseConfig,
  sourceFilter?: string
): Promise<PendingEnrichmentCounts> {
  const params = new URLSearchParams({
    select: "id,status,review_notes,normalized_event,suggested_priority,confidence_score,matched_event_id",
    status: "in.(awaiting_enrichment,pending_review,needs_changes)",
    limit: "1000"
  });

  if (sourceFilter) {
    params.set("source", `eq.${sourceFilter}`);
  }

  const rows = await supabaseFetch<EnrichmentCandidateRow[]>(supabase, `/rest/v1/event_candidates?${params}`);

  let awaiting = 0;
  let already = 0;
  let pendingReview = 0;
  let needsChanges = 0;

  for (const row of rows) {
    if (row.status === "needs_changes") {
      needsChanges += 1;
    } else if (row.status === "awaiting_enrichment") {
      /* counted via awaiting when candidateNeedsEnrichment */
    } else {
      pendingReview += 1;
    }
    if (candidateNeedsEnrichment(row)) {
      awaiting += 1;
    } else if (row.review_notes?.trimStart().startsWith("[ai]")) {
      already += 1;
    }
  }

  return {
    pending_review: pendingReview,
    needs_changes: needsChanges,
    awaiting_enrichment: awaiting,
    already_enriched: already
  };
}

export async function enrichRecentCandidates(
  env: IngestEnv,
  supabase: SupabaseConfig,
  batchSize: number,
  options: EnrichRecentCandidatesOptions = {}
): Promise<EnrichmentSummary> {
  const summary: EnrichmentSummary = {
    processed: 0,
    updated: 0,
    auto_rejected: 0,
    errors: 0,
    skipped_sufficient_data: 0,
    skipped_no_backend: false,
    batches: 1
  };

  if (!getAiBackend(env, "enrichment")) {
    summary.skipped_no_backend = true;
    return summary;
  }

  const limit = Math.min(Math.max(batchSize, 1), 100);

  const params = new URLSearchParams({
    select: "id,status,normalized_event,confidence_score,review_notes,suggested_priority,matched_event_id",
    status: "in.(awaiting_enrichment,needs_changes)",
    order: "created_at.asc",
    limit: String(limit)
  });

  if (options.sourceFilter) {
    params.set("source", `eq.${options.sourceFilter}`);
  }

  const rows = await supabaseFetch<EnrichmentCandidateRow[]>(supabase, `/rest/v1/event_candidates?${params}`);
  const toProcess: EnrichmentCandidateRow[] = [];
  let batchTitleChanged = 0;
  let batchCategoryChanged = 0;
  let batchTagsAdded = 0;
  let batchNormalizedPatched = 0;

  for (const row of rows) {
    if (candidateNeedsEnrichment(row)) {
      toProcess.push(row);
      continue;
    }
    summary.skipped_sufficient_data += 1;
    const shortTitle =
      row.normalized_event.title.length > 48
        ? `${row.normalized_event.title.slice(0, 47)}…`
        : row.normalized_event.title;
    console.log(`[ingest] sufficient (no LLM): "${shortTitle}"`);
    logStruct(env, "ai_enrichment_item_sufficient", {
      candidate_id: row.id,
      title: row.normalized_event.title,
      source: row.normalized_event.source,
      venue: row.normalized_event.venueName,
      action: options.dryRun ? "would_tag_without_llm" : "tagged_without_llm"
    });
    if (!options.dryRun && !hasAiEnrichmentNotes(row.review_notes)) {
      await markSufficientWithoutLlm(supabase, row);
      summary.updated += 1;
    }
  }

  console.log(
    `[ingest] enrichment batch: ${toProcess.length} to process, ${summary.skipped_sufficient_data} sufficient (skipped LLM), limit ${limit}${options.sourceFilter ? `, source ${options.sourceFilter}` : ""}${options.dryRun ? ", dry-run" : ""}`
  );
  logStruct(env, "ai_enrichment_batch_start", {
    fetched: rows.length,
    will_process: toProcess.length,
    skipped_sufficient_data: summary.skipped_sufficient_data,
    batch_limit: limit,
    dry_run: options.dryRun ?? false,
    ...(options.sourceFilter ? { source_filter: options.sourceFilter } : {})
  });

  for (const row of toProcess) {
    summary.processed += 1;
    const index = summary.processed;
    const ev = row.normalized_event;
    const progress = { index, total: toProcess.length };

    try {
      const enrichment = await enrichCandidate(env, row.normalized_event);
      if (!enrichment) {
        const shortTitle = ev.title.length > 48 ? `${ev.title.slice(0, 47)}…` : ev.title;
        console.log(`[ingest] enrich skip ${index}/${toProcess.length}: no model response — "${shortTitle}"`);
        logStruct(env, "ai_enrichment_item_skip", {
          candidate_id: row.id,
          index,
          reason: "no_model_response"
        });
        continue;
      }

      const patch: CandidatePatch = {
        confidence_score: enrichment.confidence,
        suggested_priority: enrichment.suggested_priority,
        review_notes: enrichment.reasoning ? `[ai] ${enrichment.reasoning}` : "[ai] enriched",
        updated_at: new Date().toISOString()
      };

      if (row.status === "awaiting_enrichment" && !enrichment.is_junk) {
        patch.status = "pending_review";
      }

      if (enrichment.is_junk) {
        patch.status = "rejected";
        patch.reviewed_by = "ai";
        patch.reviewed_at = new Date().toISOString();
        summary.auto_rejected += 1;
        if (row.status === "needs_changes") {
          logStruct(env, "ai_enrichment_item_rejected_changed", {
            candidate_id: row.id,
            matched_event_id: row.matched_event_id ?? null,
            title: ev.title
          });
        }
      }

      const autoReject = enrichment.is_junk;
      const delta = summarizeEnrichmentDelta(row.normalized_event, enrichment, { autoReject });
      if (delta.title_changed) {
        batchTitleChanged += 1;
      }
      if (delta.category_changed) {
        batchCategoryChanged += 1;
      }
      if (delta.tags_added.length > 0) {
        batchTagsAdded += 1;
      }
      if (delta.normalized_event_patched) {
        batchNormalizedPatched += 1;
      }

      const enrichedNormalized = applyEnrichment(row.normalized_event, enrichment);
      if (enrichedNormalized) {
        patch.normalized_event = enrichedNormalized;
      }
      if (delta.title_changed) {
        patch.title = delta.title_after;
      }

      const doneLog = {
        candidate_id: row.id,
        index,
        source: ev.source,
        title: delta.title_after,
        venue: ev.venueName,
        start_ts: ev.startTs,
        confidence: enrichment.confidence,
        is_junk: enrichment.is_junk,
        category: delta.category_after,
        suggested_priority: enrichment.suggested_priority,
        changes: delta,
        db_fields: delta.db_fields,
        reasoning_preview: reasoningPreview(enrichment.reasoning)
      };
      const doneLine = formatEnrichmentDoneLine(ev.title, delta, enrichment, progress);

      if (options.dryRun) {
        console.log(`${doneLine} (dry-run)`);
        logStruct(env, "ai_enrichment_item_would_patch", { would_patch: patch, ...doneLog });
      } else {
        await patchCandidate(supabase, row.id, patch);
        summary.updated += 1;
        console.log(doneLine);
        logStruct(env, "ai_enrichment_item_done", doneLog);
      }
    } catch (error) {
      summary.errors += 1;
      const shortTitle = ev.title.length > 48 ? `${ev.title.slice(0, 47)}…` : ev.title;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[ingest] enrich error ${index}/${toProcess.length}: ${message} — "${shortTitle}"`);
      logStruct(env, "ai_enrichment_item_error", {
        candidate_id: row.id,
        index,
        message
      });
    }
  }

  console.log(
    `[ingest] enrichment batch done: processed ${summary.processed}, updated ${summary.updated}, rejected ${summary.auto_rejected}, errors ${summary.errors}, title Δ ${batchTitleChanged}, category Δ ${batchCategoryChanged}, tags on ${batchTagsAdded} rows`
  );
  logStruct(env, "ai_enrichment_batch_end", {
    ...summary,
    title_changed: batchTitleChanged,
    category_changed: batchCategoryChanged,
    rows_with_tags_added: batchTagsAdded,
    normalized_event_patched: batchNormalizedPatched
  });

  return summary;
}

/** Run enrichment in batches until no pending rows need it (or single batch when limit set). */
export async function runEnrichmentPipeline(
  env: IngestEnv,
  supabase: SupabaseConfig,
  options: EnrichRecentCandidatesOptions = {}
): Promise<EnrichmentSummary> {
  const batchSize = options.limit ?? parsePositiveInt(env.MAX_ENRICH_PER_RUN, 50);
  const enrichAll = options.enrichAll ?? options.limit === undefined;

  const counts = await countPendingEnrichment(supabase, options.sourceFilter);

  logPhase(env, "AI enrichment starting", {
    pending_review: counts.pending_review,
    needs_changes: counts.needs_changes,
    awaiting_enrichment: counts.awaiting_enrichment,
    already_enriched: counts.already_enriched,
    batch_size: batchSize,
    enrich_all: enrichAll,
    dry_run: options.dryRun ?? false
  });

  const total: EnrichmentSummary = {
    processed: 0,
    updated: 0,
    auto_rejected: 0,
    errors: 0,
    skipped_sufficient_data: 0,
    skipped_no_backend: false,
    batches: 0
  };

  if (!getAiBackend(env, "enrichment")) {
    total.skipped_no_backend = true;
    logPhase(env, "AI enrichment skipped (no LLM provider configured)", {});
    return total;
  }

  if (counts.awaiting_enrichment === 0) {
    logPhase(env, "AI enrichment skipped (no candidates need enrichment)", { ...counts });
    return total;
  }

  let round = 0;

  do {
    round += 1;
    total.batches = round;
    const batch = await enrichRecentCandidates(env, supabase, batchSize, {
      ...options,
      enrichAll: false
    });

    total.processed += batch.processed;
    total.updated += batch.updated;
    total.auto_rejected += batch.auto_rejected;
    total.errors += batch.errors;
    total.skipped_sufficient_data += batch.skipped_sufficient_data;

    if (batch.skipped_no_backend) {
      total.skipped_no_backend = true;
      break;
    }

    logPhase(env, `AI enrichment batch ${round} done`, {
      batch_processed: batch.processed,
      batch_updated: batch.updated,
      total_processed: total.processed,
      total_updated: total.updated
    });

    if (!enrichAll || options.dryRun || batch.processed === 0) {
      break;
    }
  } while (round < 500);

  logPhase(env, "AI enrichment finished", { ...total, rounds: round });

  return total;
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function applyEnrichment(
  event: NormalizedEvent,
  enrichment: { category: NormalizedEvent["category"] | null; cleaned_title: string | null; tags: string[] }
): NormalizedEvent | null {
  let mutated = false;
  const next: NormalizedEvent = { ...event };

  if (enrichment.category && enrichment.category !== event.category) {
    next.category = enrichment.category;
    mutated = true;
  }
  if (enrichment.cleaned_title && enrichment.cleaned_title !== event.title) {
    next.title = enrichment.cleaned_title;
    mutated = true;
  }
  if (enrichment.tags.length > 0) {
    const merged = Array.from(new Set([...(event.tags ?? []), ...enrichment.tags]));
    if (merged.length !== (event.tags?.length ?? 0)) {
      next.tags = merged;
      mutated = true;
    }
  }

  return mutated ? next : null;
}

interface CandidatePatch {
  title?: string;
  confidence_score?: number;
  suggested_priority?: number;
  review_notes?: string | null;
  status?: "pending_review" | "rejected";
  reviewed_by?: string;
  reviewed_at?: string;
  normalized_event?: NormalizedEvent;
  updated_at: string;
}

async function markSufficientWithoutLlm(supabase: SupabaseConfig, row: EnrichmentCandidateRow) {
  await patchCandidate(supabase, row.id, {
    ...(row.status === "awaiting_enrichment" ? { status: "pending_review" as const } : {}),
    suggested_priority: 5,
    review_notes: "[ingest] skipped LLM — source already has title, time, category, and description",
    updated_at: new Date().toISOString()
  });
}

async function patchCandidate(supabase: SupabaseConfig, id: string, patch: CandidatePatch) {
  const params = new URLSearchParams({ id: `eq.${id}` });
  const response = await fetch(`${supabase.url}/rest/v1/event_candidates?${params}`, {
    method: "PATCH",
    headers: supabaseHeaders(supabase, {
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    }),
    body: JSON.stringify(patch)
  });

  if (!response.ok) {
    throw new Error(`PATCH event_candidates failed: ${response.status} ${await response.text()}`);
  }
}

async function supabaseFetch<T>(supabase: SupabaseConfig, path: string): Promise<T> {
  const response = await fetch(`${supabase.url}${path}`, {
    headers: supabaseHeaders(supabase)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase request ${path} failed: ${response.status} ${body}`);
  }

  return (await response.json()) as T;
}

function supabaseHeaders(supabase: SupabaseConfig, extra: Record<string, string> = {}) {
  return {
    apikey: supabase.serviceRoleKey,
    Authorization: `Bearer ${supabase.serviceRoleKey}`,
    Accept: "application/json",
    ...extra
  };
}
