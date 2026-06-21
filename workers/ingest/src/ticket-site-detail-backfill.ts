import type { NormalizedEvent } from "@fresno-events/shared";

import type { IngestEnv } from "@/env";
import { sleep } from "@/lib/sleep";
import {
  fetchAndMergeTicketSiteDetail,
  resolveTicketSiteUrlFromEvent
} from "@/scrapers/ticket-site-detail.utils";
import { isTicketSauceUrl } from "@/scrapers/ticketsauce-detail.utils";
import { getSupabaseConfig, supabaseFetch } from "@/sources";

const MAX_LIMIT = 20;
const ACTIVE_STATUSES = "in.(awaiting_enrichment,pending_review,needs_changes,approved,duplicate)";
const ROW_SELECT = "id,source,title,normalized_event";
const DEFAULT_DELAY_MS = 800;

export interface TicketSiteDetailBackfillSummary {
  candidates_considered: number;
  urls_fetched: number;
  updated_candidates: number;
  skipped_no_url: number;
  skipped_primary_source: number;
  skipped_unchanged: number;
  dry_run: boolean;
  errors: number;
}

interface TicketSiteBackfillRow {
  id: string;
  source: string;
  title: string;
  normalized_event: NormalizedEvent;
}

export interface TicketSiteDetailBackfillOptions {
  dryRun?: boolean;
  limit?: number;
  delayMs?: number;
  sourceFilter?: string;
  candidateId?: string;
}

function emptySummary(dryRun: boolean): TicketSiteDetailBackfillSummary {
  return {
    candidates_considered: 0,
    urls_fetched: 0,
    updated_candidates: 0,
    skipped_no_url: 0,
    skipped_primary_source: 0,
    skipped_unchanged: 0,
    dry_run: dryRun,
    errors: 0
  };
}

/** Venue modules that already fetch TicketSauce `/tickets` during detail enrichment. */
function isPrimaryTicketSiteSource(source: string): boolean {
  return source.includes("ticketsauce.com");
}

function rowHasTicketSiteUrl(row: TicketSiteBackfillRow): boolean {
  const event = row.normalized_event;
  for (const raw of [event.ticketUrl, event.externalUrl]) {
    const trimmed = raw?.trim();
    if (trimmed && isTicketSauceUrl(trimmed)) {
      return true;
    }
  }
  return false;
}

function pricesChanged(before: NormalizedEvent, after: NormalizedEvent): boolean {
  return before.priceMin !== after.priceMin || before.priceMax !== after.priceMax || before.ticketUrl !== after.ticketUrl;
}

async function fetchCandidateRows(
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
  options: TicketSiteDetailBackfillOptions
): Promise<TicketSiteBackfillRow[]> {
  if (options.candidateId) {
    const params = new URLSearchParams({
      select: ROW_SELECT,
      id: `eq.${options.candidateId}`,
      limit: "1"
    });
    return supabaseFetch<TicketSiteBackfillRow[]>(config, `/rest/v1/event_candidates?${params}`);
  }

  const limit = Math.min(Math.max(options.limit ?? 5, 1), MAX_LIMIT);
  const params = new URLSearchParams({
    select: ROW_SELECT,
    status: ACTIVE_STATUSES,
    or: "(normalized_event->>externalUrl.ilike.*ticketsauce.com*,normalized_event->>ticketUrl.ilike.*ticketsauce.com*)",
    order: "updated_at.asc",
    limit: String(Math.min(Math.max(limit * 10, 50), 200))
  });

  const rows = await supabaseFetch<TicketSiteBackfillRow[]>(
    config,
    `/rest/v1/event_candidates?${params}`
  );

  return rows.filter((row) => {
    if (options.sourceFilter && row.source !== options.sourceFilter) {
      return false;
    }
    return rowHasTicketSiteUrl(row);
  });
}

async function patchCandidate(
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
  row: TicketSiteBackfillRow,
  merged: NormalizedEvent,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    return;
  }

  await supabaseFetch(config, `/rest/v1/event_candidates?id=eq.${row.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      normalized_event: merged,
      updated_at: new Date().toISOString()
    })
  });
}

/**
 * Cross-source TicketSauce price backfill for rows that link out to a tickets page
 * (e.g. VenuNite → TicketSauce). Primary TicketSauce venue scrapes are enriched in-line.
 */
export async function runTicketSiteDetailBackfill(
  env: Pick<IngestEnv, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY" | "USER_AGENT">,
  options: TicketSiteDetailBackfillOptions = {}
): Promise<TicketSiteDetailBackfillSummary> {
  const config = getSupabaseConfig(env);
  if (!config) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for ticket-site detail backfill.");
  }

  const limit = Math.min(Math.max(options.limit ?? 5, 1), MAX_LIMIT);
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  const dryRun = options.dryRun ?? false;
  const userAgent = env.USER_AGENT?.trim() || "fresno-events-ingest/1.0";
  const summary = emptySummary(dryRun);

  const rows = await fetchCandidateRows(config, options);
  summary.candidates_considered = rows.length;

  let processed = 0;

  for (const row of rows) {
    if (processed >= limit) {
      break;
    }

    if (isPrimaryTicketSiteSource(row.source)) {
      summary.skipped_primary_source += 1;
      continue;
    }

    if (!resolveTicketSiteUrlFromEvent(row.normalized_event)) {
      summary.skipped_no_url += 1;
      continue;
    }

    processed += 1;
    summary.urls_fetched += 1;

    console.log(
      `[ingest] ticket-site detail ${processed}/${limit}: "${row.title}" (${row.source})${dryRun ? " · dry-run" : ""}`
    );

    if (dryRun) {
      summary.updated_candidates += 1;
      continue;
    }

    try {
      const merged = await fetchAndMergeTicketSiteDetail(row.normalized_event, { userAgent });
      if (!pricesChanged(row.normalized_event, merged)) {
        summary.skipped_unchanged += 1;
        continue;
      }

      await patchCandidate(config, row, merged, dryRun);
      summary.updated_candidates += 1;

      console.log(
        JSON.stringify({
          event: "ticket_site_detail_fetched",
          candidate_id: row.id,
          source: row.source,
          price_min: merged.priceMin ?? null,
          price_max: merged.priceMax ?? null
        })
      );
    } catch (error) {
      summary.errors += 1;
      console.log(
        JSON.stringify({
          event: "ticket_site_detail_error",
          candidate_id: row.id,
          source: row.source,
          message: error instanceof Error ? error.message : String(error)
        })
      );
    }

    if (processed < limit) {
      await sleep(delayMs);
    }
  }

  console.log(
    `[ingest] ticket-site detail done: urls=${summary.urls_fetched}, updated=${summary.updated_candidates}, skipped_primary=${summary.skipped_primary_source}, unchanged=${summary.skipped_unchanged}, errors=${summary.errors}`
  );

  return summary;
}
