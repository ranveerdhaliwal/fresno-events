import type { IngestEnv } from "@/env";
import { getSupabaseConfig } from "@/sources";
import type { VenueRunDebug } from "@/venues/venue.types";

export type VenueRunStatus =
  | "running"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "skipped"
  | "dry_run";

export interface VenueIngestRunRow {
  id: string;
  venue_key: string;
  ingest_run_id: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  events_found: number;
  br_crawl_job_id: string | null;
  br_crawl_status: string | null;
  debug: VenueRunDebug;
}

async function supabaseHeaders(
  env: IngestEnv,
  prefer: "return=representation" | "return=minimal" = "return=representation"
) {
  const supabase = getSupabaseConfig(env);
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return {
    url: supabase.url,
    headers: {
      apikey: supabase.serviceRoleKey,
      Authorization: `Bearer ${supabase.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: prefer
    }
  };
}

export async function startVenueRun(
  env: IngestEnv,
  venueKey: string,
  ingestRunId: string,
  dryRun: boolean
): Promise<string> {
  const { url, headers } = await supabaseHeaders(env);
  const status: VenueRunStatus = dryRun ? "dry_run" : "running";
  const now = new Date().toISOString();

  const runRes = await fetch(`${url}/rest/v1/venue_ingest_runs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      venue_key: venueKey,
      ingest_run_id: ingestRunId,
      started_at: now,
      status
    })
  });

  if (!runRes.ok) {
    const body = await runRes.text();
    throw new Error(`venue_ingest_runs insert failed (${runRes.status}): ${body}`);
  }

  const rows = (await runRes.json()) as VenueIngestRunRow[];
  const rowId = rows[0]?.id;
  if (!rowId) {
    throw new Error("venue_ingest_runs insert returned no id");
  }

  await fetch(`${url}/rest/v1/venue_ingest_state`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      venue_key: venueKey,
      last_ingest_run_id: ingestRunId,
      last_started_at: now,
      last_finished_at: null,
      last_status: status,
      events_found_last_run: 0,
      listing_urls_found: 0,
      detail_urls_visited: 0,
      debug: {},
      updated_at: now
    })
  });

  return rowId;
}

export async function finishVenueRun(
  env: IngestEnv,
  opts: {
    venueRunId: string;
    venueKey: string;
    ingestRunId: string;
    status: VenueRunStatus;
    eventsFound: number;
    listingUrlsFound: number;
    detailUrlsVisited: number;
    debug: VenueRunDebug;
    brCrawlJobId?: string | null;
    brCrawlStatus?: string | null;
  }
): Promise<void> {
  const { url, headers } = await supabaseHeaders(env, "return=minimal");
  const now = new Date().toISOString();

  const runPatch = await fetch(`${url}/rest/v1/venue_ingest_runs?id=eq.${opts.venueRunId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      finished_at: now,
      status: opts.status,
      events_found: opts.eventsFound,
      br_crawl_job_id: opts.brCrawlJobId ?? null,
      br_crawl_status: opts.brCrawlStatus ?? null,
      debug: opts.debug
    })
  });

  if (!runPatch.ok) {
    const body = await runPatch.text();
    throw new Error(`venue_ingest_runs patch failed (${runPatch.status}): ${body}`);
  }

  const statePatch = await fetch(
    `${url}/rest/v1/venue_ingest_state?venue_key=eq.${encodeURIComponent(opts.venueKey)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        last_ingest_run_id: opts.ingestRunId,
        last_finished_at: now,
        last_status: opts.status,
        events_found_last_run: opts.eventsFound,
        listing_urls_found: opts.listingUrlsFound,
        detail_urls_visited: opts.detailUrlsVisited,
        br_crawl_job_id: opts.brCrawlJobId ?? null,
        br_crawl_status: opts.brCrawlStatus ?? null,
        debug: opts.debug,
        updated_at: now
      })
    }
  );

  if (!statePatch.ok) {
    const body = await statePatch.text();
    throw new Error(`venue_ingest_state patch failed (${statePatch.status}): ${body}`);
  }
}
