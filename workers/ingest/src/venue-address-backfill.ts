import { resolveVenueLocationFields, type NormalizedEvent } from "@fresno-events/shared";

import { contentFingerprint } from "@/candidates/content-fingerprint.utils";
import type { IngestEnv } from "@/env";
import { getSupabaseConfig, supabaseFetch, supabaseHeaders, type SupabaseConfig } from "@/sources";
import {
  looksLikeMailingLine,
  normalizeStoredVenueEvent
} from "@/venue-address-backfill.utils";

const PAGE_SIZE = 200;

export interface VenueAddressBackfillOptions {
  dryRun?: boolean;
  sourceFilter?: string;
}

export interface VenueAddressBackfillSummary {
  dry_run: boolean;
  scanned: number;
  candidate_updates: number;
  venue_updates: number;
  errors: number;
}

interface CandidateBackfillRow {
  id: string;
  source: string;
  status: string;
  matched_event_id: string | null;
  normalized_event: NormalizedEvent;
}

interface VenueRow {
  id: string;
  address: string | null;
  city: string | null;
}

export function formatVenueAddressBackfillMessage(summary: VenueAddressBackfillSummary): string {
  const mode = summary.dry_run ? "check only" : "applied";
  const lines = [
    `Venue address backfill (${mode})`,
    `  scanned: ${summary.scanned} candidates`,
    `  candidate updates: ${summary.candidate_updates}`,
    `  venue updates: ${summary.venue_updates}`
  ];
  if (!summary.dry_run) {
    lines.push(`  errors: ${summary.errors}`);
  }
  if (summary.dry_run && summary.candidate_updates === 0 && summary.venue_updates === 0) {
    lines.push("  no mailing-line addresses found — nothing to fix");
  } else if (summary.dry_run) {
    lines.push(`  re-run without dry_run to apply ${summary.candidate_updates + summary.venue_updates} update(s)`);
  }
  return lines.join("\n");
}

async function fetchCandidatePage(
  supabase: SupabaseConfig,
  offset: number,
  sourceFilter?: string
): Promise<CandidateBackfillRow[]> {
  const params = new URLSearchParams({
    select: "id,source,status,matched_event_id,normalized_event",
    limit: String(PAGE_SIZE),
    offset: String(offset),
    order: "id.asc"
  });
  if (sourceFilter) {
    params.set("source", `eq.${sourceFilter}`);
  }

  return supabaseFetch<CandidateBackfillRow[]>(supabase, `/rest/v1/event_candidates?${params}`);
}

async function patchCandidate(
  supabase: SupabaseConfig,
  id: string,
  normalizedEvent: NormalizedEvent,
  fingerprint: string
): Promise<void> {
  await supabaseFetch(supabase, `/rest/v1/event_candidates?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      ...supabaseHeaders(supabase, { "Content-Type": "application/json" }),
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      normalized_event: normalizedEvent,
      content_fingerprint: fingerprint,
      updated_at: new Date().toISOString()
    })
  });
}

async function patchVenue(
  supabase: SupabaseConfig,
  id: string,
  address: string,
  city?: string | null
): Promise<void> {
  await supabaseFetch(supabase, `/rest/v1/venues?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      ...supabaseHeaders(supabase, { "Content-Type": "application/json" }),
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      address,
      ...(city ? { city } : {}),
      updated_at: new Date().toISOString()
    })
  });
}

export async function runVenueAddressBackfill(
  env: IngestEnv,
  options: VenueAddressBackfillOptions = {}
): Promise<VenueAddressBackfillSummary> {
  const supabase = getSupabaseConfig(env);
  if (!supabase) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for venue address backfill.");
  }

  const dryRun = options.dryRun ?? false;
  let offset = 0;
  let scanned = 0;
  let candidateUpdates = 0;
  let venueUpdates = 0;
  let errors = 0;
  const venueIds = new Set<string>();

  while (true) {
    const rows = await fetchCandidatePage(supabase, offset, options.sourceFilter);
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      scanned += 1;
      const currentAddress = row.normalized_event.venueAddress?.trim() ?? "";
      if (!looksLikeMailingLine(currentAddress)) {
        continue;
      }

      const nextEvent = normalizeStoredVenueEvent(row.normalized_event);
      if (!nextEvent) {
        continue;
      }

      candidateUpdates += 1;
      if (!dryRun) {
        try {
          const fingerprint = await contentFingerprint(nextEvent);
          await patchCandidate(supabase, row.id, nextEvent, fingerprint);
        } catch (error) {
          errors += 1;
          console.log(
            JSON.stringify({
              event: "venue_address_backfill_candidate_failed",
              candidate_id: row.id,
              message: error instanceof Error ? error.message : String(error)
            })
          );
        }
      }

      if (row.status === "approved" && row.matched_event_id) {
        const events = await supabaseFetch<Array<{ venue_id?: string }>>(
          supabase,
          `/rest/v1/events?select=id,venue_id&id=eq.${row.matched_event_id}&limit=1`
        );
        const venueId = events[0]?.venue_id;
        if (venueId) {
          venueIds.add(venueId);
        }
      }
    }

    if (rows.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }

  for (const venueId of venueIds) {
    const venues = await supabaseFetch<VenueRow[]>(
      supabase,
      `/rest/v1/venues?select=id,address,city&id=eq.${venueId}&limit=1`
    );
    const venue = venues[0];
    if (!venue?.address || !looksLikeMailingLine(venue.address)) {
      continue;
    }

    const { venueAddress, venueCity } = resolveVenueLocationFields(venue.address, venue.city, "CA");
    if (!venueAddress || venueAddress === venue.address) {
      continue;
    }

    venueUpdates += 1;
    if (!dryRun) {
      try {
        await patchVenue(supabase, venueId, venueAddress, venueCity);
      } catch (error) {
        errors += 1;
        console.log(
          JSON.stringify({
            event: "venue_address_backfill_venue_failed",
            venue_id: venueId,
            message: error instanceof Error ? error.message : String(error)
          })
        );
      }
    }
  }

  const summary: VenueAddressBackfillSummary = {
    dry_run: dryRun,
    scanned,
    candidate_updates: candidateUpdates,
    venue_updates: venueUpdates,
    errors
  };

  console.log(JSON.stringify({ event: "venue_address_backfill_done", ...summary }));
  console.log(formatVenueAddressBackfillMessage(summary));
  return summary;
}
