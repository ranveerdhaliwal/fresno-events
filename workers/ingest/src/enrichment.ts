import type { NormalizedEvent } from "@fresno-events/shared";
import { formatIngestExclusionNotes, getIngestExclusion, sanitizeEventTags } from "@fresno-events/shared";

import { enrichCandidate, getAiBackend } from "@/ai";
import {
  candidateNeedsEnrichment,
  ENRICHMENT_QUEUE_STATUSES,
  formatEnrichmentDoneLine,
  isBlockedByPendingDetail,
  needsSufficientConfidenceBackfill,
  reasoningPreview,
  SUFFICIENT_WITHOUT_LLM_CONFIDENCE,
  summarizeEnrichmentDelta,
  type EnrichmentCandidateRow
} from "@/candidates/enrichment-candidate.utils";
import { harmonizeSeriesSuggestedPriority } from "@/candidates/series-enrichment.utils";
import { harmonizeLinkedOccurrencePriority } from "@/candidates/linked-priority-harmonize.utils";
import { harmonizeLinkedOccurrencePricing } from "@/candidates/linked-price-harmonize.utils";
import { applyVenuePriorityOverride, resolveVenueSuggestedPriority } from "@/candidates/venue-priority.utils";
import type { IngestEnv } from "@/env";
import type { SupabaseConfig } from "@/sources";

export interface EnrichmentSummary {
  processed: number;
  updated: number;
  auto_rejected: number;
  errors: number;
  skipped_sufficient_data: number;
  skipped_pending_detail: number;
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
    select: "id,status,review_notes,normalized_event,suggested_priority,confidence_score,matched_event_id,detail_status",
    status: ENRICHMENT_QUEUE_STATUSES,
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
    skipped_pending_detail: 0,
    skipped_no_backend: false,
    batches: 1
  };

  const limit = Math.min(Math.max(batchSize, 1), 100);
  const scanPageSize = Math.min(Math.max(limit * 3, limit), 100);

  const toProcess: EnrichmentCandidateRow[] = [];
  const hasLlmBackend = Boolean(getAiBackend(env, "enrichment"));
  let batchTitleChanged = 0;
  let batchCategoryChanged = 0;
  let batchTagsAdded = 0;
  let batchNormalizedPatched = 0;
  let scanned = 0;
  let offset = 0;

  while (toProcess.length < limit) {
    const params = new URLSearchParams({
      select:
        "id,status,normalized_event,confidence_score,review_notes,suggested_priority,matched_event_id,detail_status,occurrence_id,canonical_candidate_id",
      status: ENRICHMENT_QUEUE_STATUSES,
      order: "created_at.asc",
      limit: String(scanPageSize),
      offset: String(offset)
    });

    if (options.sourceFilter) {
      params.set("source", `eq.${options.sourceFilter}`);
    }

    const rows = await supabaseFetch<EnrichmentCandidateRow[]>(
      supabase,
      `/rest/v1/event_candidates?${params}`
    );
    if (rows.length === 0) {
      break;
    }

    scanned += rows.length;

    for (const row of rows) {
      if (isBlockedByPendingDetail(row)) {
        summary.skipped_pending_detail += 1;
        continue;
      }
      if (await rejectIngestExcludedCandidate(supabase, row, options.dryRun ?? false)) {
        summary.auto_rejected += 1;
        if (!options.dryRun) {
          summary.updated += 1;
        }
        continue;
      }
      if (candidateNeedsEnrichment(row)) {
        toProcess.push(row);
        if (toProcess.length >= limit) {
          break;
        }
        continue;
      }
      summary.skipped_sufficient_data += 1;
      logStruct(env, "ai_enrichment_item_sufficient", {
        candidate_id: row.id,
        title: row.normalized_event.title,
        source: row.normalized_event.source,
        venue: row.normalized_event.venueName,
        action: options.dryRun ? "would_tag_without_llm" : "tagged_without_llm"
      });
      if (!options.dryRun && needsSufficientConfidenceBackfill(row)) {
        await markSufficientWithoutLlm(supabase, row);
        summary.updated += 1;

        const linked = await harmonizeLinkedOccurrencePriority(supabase, row.occurrence_id);
        if (linked.primaryUpdated) {
          summary.updated += 1;
        }
        const priced = await harmonizeLinkedOccurrencePricing(supabase, row.occurrence_id);
        if (priced.rowsUpdated > 0) {
          summary.updated += priced.rowsUpdated;
        }
      }
    }

    offset += rows.length;
    if (rows.length < scanPageSize) {
      break;
    }
  }

  console.log(
    `[ingest] enrichment batch: ${toProcess.length} to process, ${summary.skipped_sufficient_data} sufficient (skipped LLM), ${summary.skipped_pending_detail} pending detail, scanned ${scanned}, limit ${limit}${options.sourceFilter ? `, source ${options.sourceFilter}` : ""}${options.dryRun ? ", dry-run" : ""}`
  );
  logStruct(env, "ai_enrichment_batch_start", {
    scanned,
    will_process: toProcess.length,
    skipped_sufficient_data: summary.skipped_sufficient_data,
    batch_limit: limit,
    dry_run: options.dryRun ?? false,
    has_llm_backend: hasLlmBackend,
    ...(options.sourceFilter ? { source_filter: options.sourceFilter } : {})
  });

  if (!hasLlmBackend) {
    summary.skipped_no_backend = true;
    if (toProcess.length > 0) {
      console.log(
        `[ingest] ${toProcess.length} candidate(s) still need LLM enrichment but no provider is configured`
      );
    }
    return summary;
  }

  for (const row of toProcess) {
    summary.processed += 1;
    const index = summary.processed;
    const ev = row.normalized_event;
    const progress = { index, total: toProcess.length };

    try {
      if (await rejectIngestExcludedCandidate(supabase, row, options.dryRun ?? false)) {
        summary.auto_rejected += 1;
        if (!options.dryRun) {
          summary.updated += 1;
        }
        continue;
      }

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

      const aiNotes = enrichment.reasoning ? `[ai] ${enrichment.reasoning}` : "[ai] enriched";
      const venuePriority = applyVenuePriorityOverride(row.normalized_event, enrichment.suggested_priority, aiNotes);

      const patch: CandidatePatch = {
        confidence_score: enrichment.confidence,
        suggested_priority: venuePriority.suggested_priority,
        review_notes: venuePriority.review_notes,
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
        suggested_priority: venuePriority.suggested_priority,
        changes: delta,
        db_fields: delta.db_fields,
        reasoning_preview: reasoningPreview(enrichment.reasoning)
      };
      const doneLine = formatEnrichmentDoneLine(ev.title, delta, {
        ...enrichment,
        suggested_priority: venuePriority.suggested_priority
      }, progress);

      if (options.dryRun) {
        console.log(`${doneLine} (dry-run)`);
        logStruct(env, "ai_enrichment_item_would_patch", { would_patch: patch, ...doneLog });
      } else {
        await patchCandidate(supabase, row.id, patch);
        summary.updated += 1;

        const harmonized = await harmonizeSeriesSuggestedPriority(
          supabase,
          row,
          venuePriority.suggested_priority
        );
        if (harmonized.unified !== venuePriority.suggested_priority) {
          await patchCandidate(supabase, row.id, {
            suggested_priority: harmonized.unified,
            updated_at: new Date().toISOString()
          });
        }
        summary.updated += harmonized.siblingsUpdated;

        const linked = await harmonizeLinkedOccurrencePriority(supabase, row.occurrence_id);
        if (linked.primaryUpdated) {
          summary.updated += 1;
        }

        const priced = await harmonizeLinkedOccurrencePricing(supabase, row.occurrence_id);
        if (priced.rowsUpdated > 0) {
          summary.updated += priced.rowsUpdated;
        }

        console.log(doneLine);
        logStruct(env, "ai_enrichment_item_done", {
          ...doneLog,
          series_priority_unified: harmonized.unified,
          series_siblings_updated: harmonized.siblingsUpdated,
          linked_primary_priority: linked.unified,
          linked_primary_updated: linked.primaryUpdated,
          linked_price_rows_updated: priced.rowsUpdated,
          linked_price_from_source: priced.pricedFromSource
        });
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
    skipped_pending_detail: 0,
    skipped_no_backend: false,
    batches: 0
  };

  if (!getAiBackend(env, "enrichment")) {
    total.skipped_no_backend = true;
    logPhase(env, "AI enrichment skipped (no LLM provider configured)", {});
    const promoted = await enrichRecentCandidates(env, supabase, batchSize, options);
    total.updated += promoted.updated;
    total.skipped_sufficient_data += promoted.skipped_sufficient_data;
    total.batches = 1;
    if (promoted.updated > 0) {
      logPhase(env, "Promoted sufficient candidates to pending_review without LLM", {
        updated: promoted.updated
      });
    }
    return total;
  }

  if (counts.awaiting_enrichment === 0) {
    let promoteRound = 0;
    do {
      promoteRound += 1;
      const promoted = await enrichRecentCandidates(env, supabase, batchSize, options);
      total.updated += promoted.updated;
      total.skipped_sufficient_data += promoted.skipped_sufficient_data;
      total.skipped_pending_detail += promoted.skipped_pending_detail;
      total.batches = promoteRound;
      if (promoted.updated === 0) {
        if (
          promoteRound === 1 &&
          promoted.skipped_sufficient_data === 0 &&
          promoted.skipped_pending_detail === 0
        ) {
          logPhase(env, "AI enrichment skipped (no candidates need enrichment)", { ...counts });
        }
        break;
      }
      if (!enrichAll || options.dryRun) {
        break;
      }
    } while (promoteRound < 500);

    if (total.updated > 0) {
      logPhase(env, "Promoted sufficient candidates to pending_review without LLM", {
        updated: total.updated
      });
    }
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
    total.skipped_pending_detail += batch.skipped_pending_detail;

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
    const merged = sanitizeEventTags([...(event.tags ?? []), ...enrichment.tags]);
    if (merged.length !== (event.tags?.length ?? 0) || merged.some((t, i) => t !== event.tags?.[i])) {
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
  const venuePriority = resolveVenueSuggestedPriority(row.normalized_event);
  // Venue rules win over a stale suggested_priority (e.g. cross-title series harmonize).
  const priority = venuePriority ?? row.suggested_priority ?? 5;
  const notes =
    venuePriority !== null
      ? `[ingest] skipped LLM — source already has title, time, category, and description · [venue] → P${venuePriority}`
      : "[ingest] skipped LLM — source already has title, time, category, and description";

  await patchCandidate(supabase, row.id, {
    ...(row.status === "awaiting_enrichment" ? { status: "pending_review" as const } : {}),
    confidence_score: SUFFICIENT_WITHOUT_LLM_CONFIDENCE,
    suggested_priority: priority,
    review_notes: notes,
    updated_at: new Date().toISOString()
  });

  await harmonizeSeriesSuggestedPriority(supabase, row, priority);
}

async function rejectIngestExcludedCandidate(
  supabase: SupabaseConfig,
  row: EnrichmentCandidateRow,
  dryRun: boolean
): Promise<boolean> {
  if (row.status === "rejected") {
    return false;
  }
  const exclusion = getIngestExclusion({
    title: row.normalized_event.title,
    descriptionText: row.normalized_event.descriptionText ?? null
  });
  if (!exclusion) {
    return false;
  }
  if (!dryRun) {
    await patchCandidate(supabase, row.id, {
      status: "rejected",
      reviewed_by: "ingest",
      reviewed_at: new Date().toISOString(),
      review_notes: formatIngestExclusionNotes(exclusion),
      updated_at: new Date().toISOString()
    });
  }
  return true;
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
