import type { NormalizedEvent } from "@fresno-events/shared";

import {
  computeRelinkPatches,
  type RelinkCandidateRow,
  type RelinkPatch,
  type RelinkPlanSummary,
  type RelinkPublishedEvent
} from "@/candidates/occurrence-relink.utils";
import type { IngestEnv } from "@/env";
import { getSupabaseConfig, supabaseFetch, supabaseHeaders, type SupabaseConfig } from "@/sources";

const PAGE_SIZE = 1000;
const PATCH_BATCH_SIZE = 50;

export interface OccurrenceRelinkOptions {
  dryRun?: boolean;
  sourceFilter?: string;
  limit?: number;
}

export interface OccurrenceRelinkSummary extends RelinkPlanSummary {
  dry_run: boolean;
  changed: number;
  applied: number;
  unchanged: number;
  errors: number;
}

export function formatRelinkSummaryMessage(summary: OccurrenceRelinkSummary): string {
  const mode = summary.dry_run ? "DRY RUN" : "DONE";
  const lines = [
    `[ingest] occurrence relink ${mode}`,
    `  candidates: ${summary.candidates} total (${summary.relinkable} relinkable, ${summary.skipped_rejected} rejected skipped)`,
    `  groups: ${summary.groups} show occurrences (${summary.multi_source_groups} cross-source)`,
    `  rows to update: ${summary.changed} (${summary.unchanged} already correct)`,
    `  linked as duplicate: ${summary.linked_as_duplicate}`,
    `  promoted duplicate → primary: ${summary.promoted_from_duplicate}`,
    `  demoted → duplicate: ${summary.demoted_to_duplicate}`,
    `  priority inherited: ${summary.priority_inherited}`
  ];
  if (!summary.dry_run) {
    lines.push(`  applied: ${summary.applied}, errors: ${summary.errors}`);
  }
  return lines.join("\n");
}

interface RelinkCandidateDbRow {
  id: string;
  source: string;
  source_event_id: string;
  status: string;
  matched_event_id: string | null;
  canonical_candidate_id: string | null;
  occurrence_id: string | null;
  occurrence_key: string | null;
  url_key: string | null;
  suggested_priority: number | null;
  created_at: string;
  normalized_event: NormalizedEvent;
}

function isCrossSourceDedupeEnabled(env: IngestEnv): boolean {
  const value = env.INGEST_CROSS_SOURCE_DEDUPE?.trim().toLowerCase();
  if (value === "false" || value === "0" || value === "off") {
    return false;
  }
  return true;
}

function patchChanged(before: RelinkCandidateRow, patch: RelinkPatch): boolean {
  return (
    before.occurrence_id !== patch.occurrence_id ||
    before.occurrence_key !== patch.occurrence_key ||
    before.url_key !== patch.url_key ||
    before.canonical_candidate_id !== patch.canonical_candidate_id ||
    before.matched_event_id !== patch.matched_event_id ||
    before.status !== patch.status ||
    (patch.suggested_priority !== undefined &&
      before.suggested_priority !== patch.suggested_priority)
  );
}

async function fetchAllCandidates(
  supabase: SupabaseConfig,
  options: OccurrenceRelinkOptions
): Promise<RelinkCandidateRow[]> {
  const all: RelinkCandidateRow[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      select:
        "id,source,source_event_id,status,matched_event_id,canonical_candidate_id,occurrence_id,occurrence_key,url_key,suggested_priority,created_at,normalized_event",
      order: "created_at.asc",
      limit: String(PAGE_SIZE),
      offset: String(offset)
    });
    if (options.sourceFilter) {
      params.set("source", `eq.${options.sourceFilter}`);
    }

    const page = await supabaseFetch<RelinkCandidateDbRow[]>(
      supabase,
      `/rest/v1/event_candidates?${params}`
    );

    all.push(...page);
    if (options.limit !== undefined && all.length >= options.limit) {
      return all.slice(0, options.limit);
    }
    if (page.length < PAGE_SIZE) {
      break;
    }
    offset += page.length;
  }

  return all;
}

async function fetchPublishedEvents(supabase: SupabaseConfig): Promise<RelinkPublishedEvent[]> {
  return supabaseFetch<RelinkPublishedEvent[]>(
    supabase,
    "/rest/v1/events?select=id,occurrence_id,occurrence_key,status&status=eq.scheduled&limit=5000"
  );
}

async function applyPatch(supabase: SupabaseConfig, patch: RelinkPatch): Promise<void> {
  await supabaseFetch(supabase, `/rest/v1/event_candidates?id=eq.${patch.id}`, {
    method: "PATCH",
    headers: {
      ...supabaseHeaders(supabase, { "Content-Type": "application/json" }),
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      occurrence_id: patch.occurrence_id,
      occurrence_key: patch.occurrence_key,
      url_key: patch.url_key,
      canonical_candidate_id: patch.canonical_candidate_id,
      matched_event_id: patch.matched_event_id,
      status: patch.status,
      ...(patch.suggested_priority !== undefined
        ? { suggested_priority: patch.suggested_priority }
        : {}),
      updated_at: new Date().toISOString()
    })
  });
}

export async function runOccurrenceRelink(
  env: IngestEnv,
  options: OccurrenceRelinkOptions = {}
): Promise<OccurrenceRelinkSummary> {
  const supabase = getSupabaseConfig(env);
  if (!supabase) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for occurrence relink.");
  }

  const dryRun = options.dryRun ?? false;
  const crossSourceDedupe = isCrossSourceDedupeEnabled(env);
  const rows = await fetchAllCandidates(supabase, options);
  const publishedEvents = await fetchPublishedEvents(supabase);
  const { patches, summary } = await computeRelinkPatches(rows, publishedEvents, { crossSourceDedupe });

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const changedPatches = patches.filter((patch) => {
    const before = rowById.get(patch.id);
    return before ? patchChanged(before, patch) : false;
  });

  console.log(
    JSON.stringify({
      event: "ingest_occurrence_relink_plan",
      dry_run: dryRun,
      cross_source_dedupe: crossSourceDedupe,
      ...summary,
      changed: changedPatches.length
    })
  );
  console.log(
    formatRelinkSummaryMessage({
      ...summary,
      dry_run: dryRun,
      changed: changedPatches.length,
      applied: 0,
      unchanged: patches.length - changedPatches.length,
      errors: 0
    })
  );

  if (dryRun) {
    return {
      ...summary,
      dry_run: true,
      changed: changedPatches.length,
      applied: 0,
      unchanged: patches.length - changedPatches.length,
      errors: 0
    };
  }

  let applied = 0;
  let errors = 0;

  for (let offset = 0; offset < changedPatches.length; offset += PATCH_BATCH_SIZE) {
    const batch = changedPatches.slice(offset, offset + PATCH_BATCH_SIZE);
    await Promise.all(
      batch.map(async (patch) => {
        try {
          await applyPatch(supabase, patch);
          applied += 1;
        } catch (error) {
          errors += 1;
          console.log(
            JSON.stringify({
              event: "ingest_occurrence_relink_patch_failed",
              candidate_id: patch.id,
              message: error instanceof Error ? error.message : String(error)
            })
          );
        }
      })
    );
  }

  const result: OccurrenceRelinkSummary = {
    ...summary,
    dry_run: false,
    changed: changedPatches.length,
    applied,
    unchanged: patches.length - changedPatches.length,
    errors
  };

  console.log(JSON.stringify({ event: "ingest_occurrence_relink_done", ...result }));
  console.log(formatRelinkSummaryMessage(result));
  return result;
}
