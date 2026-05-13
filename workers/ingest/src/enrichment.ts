import type { NormalizedEvent } from "@fresno-events/shared";

import { enrichCandidate, getAiBackend } from "@/ai";
import type { IngestEnv } from "@/env";
import type { SupabaseConfig } from "@/sources";

export interface EnrichmentSummary {
  processed: number;
  updated: number;
  auto_rejected: number;
  errors: number;
  skipped_no_backend: boolean;
}

export async function enrichRecentCandidates(env: IngestEnv, supabase: SupabaseConfig, limit: number): Promise<EnrichmentSummary> {
  const summary: EnrichmentSummary = {
    processed: 0,
    updated: 0,
    auto_rejected: 0,
    errors: 0,
    skipped_no_backend: false
  };

  if (!getAiBackend(env, "enrichment")) {
    summary.skipped_no_backend = true;
    return summary;
  }

  const params = new URLSearchParams({
    select: "id,normalized_event,confidence_score,review_notes",
    status: "eq.pending_review",
    "review_notes": "is.null",
    order: "created_at.desc",
    limit: String(Math.min(Math.max(limit, 1), 100))
  });

  const rows = await supabaseFetch<CandidateRow[]>(supabase, `/rest/v1/event_candidates?${params}`);

  for (const row of rows) {
    summary.processed += 1;
    try {
      const enrichment = await enrichCandidate(env, row.normalized_event);
      if (!enrichment) {
        continue;
      }

      const patch: CandidatePatch = {
        confidence_score: enrichment.confidence,
        review_notes: enrichment.reasoning ? `[ai] ${enrichment.reasoning}` : null,
        updated_at: new Date().toISOString()
      };

      if (enrichment.is_junk) {
        patch.status = "rejected";
        patch.reviewed_by = "ai";
        patch.reviewed_at = new Date().toISOString();
        summary.auto_rejected += 1;
      }

      const enrichedNormalized = applyEnrichment(row.normalized_event, enrichment);
      if (enrichedNormalized) {
        patch.normalized_event = enrichedNormalized;
      }

      await patchCandidate(supabase, row.id, patch);
      summary.updated += 1;
    } catch {
      summary.errors += 1;
    }
  }

  return summary;
}

function applyEnrichment(event: NormalizedEvent, enrichment: { category: NormalizedEvent["category"] | null; cleaned_title: string | null; tags: string[] }): NormalizedEvent | null {
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

interface CandidateRow {
  id: string;
  normalized_event: NormalizedEvent;
  confidence_score: number;
  review_notes: string | null;
}

interface CandidatePatch {
  confidence_score?: number;
  review_notes?: string | null;
  status?: "rejected";
  reviewed_by?: string;
  reviewed_at?: string;
  normalized_event?: NormalizedEvent;
  updated_at: string;
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
    throw new Error(`Supabase request ${path} failed: ${response.status}`);
  }

  return await response.json() as T;
}

function supabaseHeaders(supabase: SupabaseConfig, extra: Record<string, string> = {}) {
  return {
    apikey: supabase.serviceRoleKey,
    Authorization: `Bearer ${supabase.serviceRoleKey}`,
    Accept: "application/json",
    ...extra
  };
}
