import type { NormalizedEvent } from "@fresno-events/shared";

import { contentFingerprint } from "@/candidates/content-fingerprint.utils";
import {
  buildLinkedPricePatches,
  type LinkedPriceMember
} from "@/candidates/linked-price.utils";
import type { SupabaseConfig } from "@/sources";
import { supabaseFetch, supabaseHeaders } from "@/sources";

interface OccurrencePriceRow {
  id: string;
  source: string;
  canonical_candidate_id: string | null;
  normalized_event: NormalizedEvent;
}

async function fetchOccurrenceMembers(
  supabase: SupabaseConfig,
  occurrenceId: string
): Promise<OccurrencePriceRow[]> {
  const params = new URLSearchParams({
    select: "id,source,canonical_candidate_id,normalized_event",
    occurrence_id: `eq.${occurrenceId}`,
    status: "in.(awaiting_enrichment,pending_review,needs_changes,approved,duplicate)",
    limit: "50"
  });

  return supabaseFetch<OccurrencePriceRow[]>(supabase, `/rest/v1/event_candidates?${params}`);
}

async function patchCandidatePricing(
  supabase: SupabaseConfig,
  id: string,
  normalized_event: NormalizedEvent
): Promise<void> {
  const fingerprint = await contentFingerprint(normalized_event);
  await supabaseFetch(supabase, `/rest/v1/event_candidates?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      ...supabaseHeaders(supabase, { "Content-Type": "application/json" }),
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      normalized_event,
      content_fingerprint: fingerprint,
      updated_at: new Date().toISOString()
    })
  });
}

export interface LinkedPriceHarmonizeResult {
  rowsUpdated: number;
  pricedFromSource: string | null;
}

/**
 * Copy price fields from linked occurrence siblings onto rows that lack them
 * (e.g. fair scrape → Ticketmaster primary).
 */
export async function harmonizeLinkedOccurrencePricing(
  supabase: SupabaseConfig,
  occurrenceId: string | null | undefined
): Promise<LinkedPriceHarmonizeResult> {
  if (!occurrenceId) {
    return { rowsUpdated: 0, pricedFromSource: null };
  }

  const rows = await fetchOccurrenceMembers(supabase, occurrenceId);
  if (rows.length <= 1) {
    return { rowsUpdated: 0, pricedFromSource: null };
  }

  const members: LinkedPriceMember[] = rows.map((row) => ({
    id: row.id,
    source: row.source,
    canonical_candidate_id: row.canonical_candidate_id,
    normalized_event: row.normalized_event
  }));

  const patches = buildLinkedPricePatches(members);
  if (patches.length === 0) {
    return { rowsUpdated: 0, pricedFromSource: null };
  }

  for (const patch of patches) {
    await patchCandidatePricing(supabase, patch.id, patch.normalized_event);
  }

  return {
    rowsUpdated: patches.length,
    pricedFromSource: patches[0]?.fromSource ?? null
  };
}

export async function harmonizeLinkedOccurrencePricingBatch(
  supabase: SupabaseConfig,
  occurrenceIds: readonly string[]
): Promise<{ occurrences: number; rowsUpdated: number }> {
  const unique = [...new Set(occurrenceIds.filter(Boolean))];
  let rowsUpdated = 0;

  for (const occurrenceId of unique) {
    const result = await harmonizeLinkedOccurrencePricing(supabase, occurrenceId);
    rowsUpdated += result.rowsUpdated;
  }

  return { occurrences: unique.length, rowsUpdated };
}
