import { clampEventPriority } from "@fresno-events/shared";

import {
  bestSuggestedPriority,
  primaryPriorityInheritUpdate,
  type LinkedPriorityMember
} from "@/candidates/linked-priority.utils";
import type { SupabaseConfig } from "@/sources";
import { supabaseFetch, supabaseHeaders } from "@/sources";

interface OccurrencePriorityRow {
  id: string;
  source: string;
  suggested_priority: number | null;
  canonical_candidate_id: string | null;
}

async function fetchOccurrenceMembers(
  supabase: SupabaseConfig,
  occurrenceId: string
): Promise<OccurrencePriorityRow[]> {
  const params = new URLSearchParams({
    select: "id,source,suggested_priority,canonical_candidate_id",
    occurrence_id: `eq.${occurrenceId}`,
    status: "in.(awaiting_enrichment,pending_review,needs_changes,approved,duplicate)",
    limit: "50"
  });

  return supabaseFetch<OccurrencePriorityRow[]>(supabase, `/rest/v1/event_candidates?${params}`);
}

async function patchSuggestedPriority(
  supabase: SupabaseConfig,
  id: string,
  priority: number
): Promise<void> {
  await supabaseFetch(supabase, `/rest/v1/event_candidates?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      ...supabaseHeaders(supabase, { "Content-Type": "application/json" }),
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      suggested_priority: clampEventPriority(priority),
      updated_at: new Date().toISOString()
    })
  });
}

export interface LinkedPriorityHarmonizeResult {
  unified: number;
  primaryUpdated: boolean;
}

/**
 * Ensure the occurrence primary inherits the best suggested_priority from linked siblings
 * (e.g. enriched Save Mart P1 → Ticketmaster primary P5).
 */
export async function harmonizeLinkedOccurrencePriority(
  supabase: SupabaseConfig,
  occurrenceId: string | null | undefined
): Promise<LinkedPriorityHarmonizeResult> {
  if (!occurrenceId) {
    return { unified: 5, primaryUpdated: false };
  }

  const rows = await fetchOccurrenceMembers(supabase, occurrenceId);
  if (rows.length <= 1) {
    return { unified: bestSuggestedPriority(rows), primaryUpdated: false };
  }

  const members: LinkedPriorityMember[] = rows.map((row) => ({
    id: row.id,
    source: row.source,
    suggested_priority: row.suggested_priority,
    canonical_candidate_id: row.canonical_candidate_id
  }));

  const inherit = primaryPriorityInheritUpdate(members);
  if (!inherit) {
    return { unified: bestSuggestedPriority(members), primaryUpdated: false };
  }

  await patchSuggestedPriority(supabase, inherit.primaryId, inherit.toPriority);
  return { unified: inherit.toPriority, primaryUpdated: true };
}
