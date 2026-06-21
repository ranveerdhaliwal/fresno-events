import type { NormalizedEvent } from "@fresno-events/shared";

import type { EnrichmentCandidateRow } from "@/candidates/enrichment-candidate.utils";
import type { SupabaseConfig } from "@/sources";
import { supabaseFetch } from "@/sources";

interface SeriesSiblingRow {
  id: string;
  suggested_priority: number | null;
}

export function enrichmentSeriesListingUrl(event: NormalizedEvent): string | null {
  const raw = event.externalUrl?.trim();
  if (!raw?.startsWith("http")) {
    return null;
  }
  try {
    const u = new URL(raw);
    u.hash = "";
    if (u.searchParams.get("format") === "ical") {
      u.search = "";
    }
    return u.href.replace(/\/+$/, "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function normalizeSeriesTitleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export function seriesHarmonizeFilterParams(row: EnrichmentCandidateRow): URLSearchParams | null {
  const seriesId = row.normalized_event.seriesId?.trim();
  if (seriesId) {
    const params = new URLSearchParams();
    params.set("normalized_event->>seriesId", `eq.${seriesId}`);
    // Venue-season series ids span unrelated listings — only harmonize same title
    // (e.g. flea market dates together, not Kansas + flea market).
    const title = row.normalized_event.title?.trim();
    if (title) {
      params.set("title", `eq.${title}`);
    }
    return params;
  }

  const listingUrl = enrichmentSeriesListingUrl(row.normalized_event);
  if (listingUrl) {
    const params = new URLSearchParams();
    params.set("normalized_event->>externalUrl", `eq.${listingUrl}`);
    return params;
  }

  return null;
}

export interface SeriesPriorityHarmonizeResult {
  unified: number;
  siblingsUpdated: number;
}

/** Align suggested_priority across recurring siblings (same series id or listing URL). */
export async function harmonizeSeriesSuggestedPriority(
  supabase: SupabaseConfig,
  row: EnrichmentCandidateRow,
  priority: number
): Promise<SeriesPriorityHarmonizeResult> {
  const seriesParams = seriesHarmonizeFilterParams(row);
  if (!seriesParams) {
    return { unified: priority, siblingsUpdated: 0 };
  }

  const params = new URLSearchParams({
    select: "id,suggested_priority",
    status: "in.(awaiting_enrichment,pending_review,needs_changes)",
    id: `neq.${row.id}`,
    limit: "100"
  });
  for (const [key, value] of seriesParams) {
    params.set(key, value);
  }

  const siblings = await supabaseFetch<SeriesSiblingRow[]>(
    supabase,
    `/rest/v1/event_candidates?${params}`
  );
  const unified = priority;

  let siblingsUpdated = 0;

  for (const sibling of siblings) {
    if (sibling.suggested_priority === unified) {
      continue;
    }
    await supabaseFetch(supabase, `/rest/v1/event_candidates?id=eq.${sibling.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        suggested_priority: unified,
        updated_at: new Date().toISOString()
      })
    });
    siblingsUpdated += 1;
  }

  return { unified, siblingsUpdated };
}
