import type { NormalizedEvent } from "@fresno-events/shared";

import { resolveCandidateDetailFields } from "@/candidates/detail-status.utils";
import type { IngestEnv } from "@/env";
import { getSupabaseConfig, supabaseFetch } from "@/sources";
import {
  finalizeVisitFresnoDetailMerge,
  parseVisitFresnoDetailPage,
  type VisitFresnoDetailFields
} from "@/scrapers/visit-fresno-detail.utils";

const DEFAULT_USER_AGENT = "fresno-events-ingest/1.0";
const DETAIL_DELAY_MS = 800;
const MAX_LIMIT = 500;

export interface DetailBackfillSummary {
  fetched_urls: number;
  updated_candidates: number;
  marked_complete: number;
  still_pending: number;
  errors: number;
  skipped_no_url: number;
  dry_run: boolean;
}

interface DetailBackfillRow {
  id: string;
  source: string;
  title: string;
  normalized_event: NormalizedEvent;
  detail_page_url: string | null;
}

export interface DetailBackfillOptions {
  dryRun?: boolean;
  sourceFilter?: string;
  limit?: number;
  userAgent?: string;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function parseDetailForSource(source: string, html: string): VisitFresnoDetailFields | null {
  if (source === "api:visitfresnocounty") {
    return parseVisitFresnoDetailPage(html);
  }
  return null;
}

function listingRecIdFromVisitFresnoUrl(url: string): string | undefined {
  const match = url.match(/\/(\d+)\/?$/);
  return match?.[1];
}

function normalizeDetailFetchUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("visitfresnocounty.org") && !parsed.pathname.endsWith("/")) {
      parsed.pathname = `${parsed.pathname}/`;
    }
    return parsed.href;
  } catch {
    return url.endsWith("/") ? url : `${url}/`;
  }
}

function isRedirectErrorPage(html: string): boolean {
  const match = html.match(/<h1[^>]*>\s*301\s+Moved\s+Permanently\s*<\/h1>/i);
  return Boolean(match);
}

async function fetchDetailHtml(url: string, userAgent: string, signal?: AbortSignal): Promise<string> {
  const fetchUrl = normalizeDetailFetchUrl(url);
  const response = await fetch(fetchUrl, {
    headers: { "User-Agent": userAgent },
    ...(signal ? { signal } : {})
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

function formatDetailBackfillUrlLine(
  urlIndex: number,
  urlTotal: number,
  title: string,
  rowCount: number,
  markedComplete: number
): string {
  const progress = `${urlIndex}/${urlTotal}`;
  const shortTitle = title.length > 48 ? `${title.slice(0, 47)}…` : title;
  const rows = rowCount === 1 ? "1 row" : `${rowCount} rows`;
  const status =
    markedComplete === rowCount
      ? "complete"
      : markedComplete > 0
        ? `${markedComplete}/${rowCount} complete`
        : "no change";
  return `[ingest] detail backfill ${progress}: "${shortTitle}" (${rows}) — ${status}`;
}

export async function runDetailBackfill(
  env: IngestEnv,
  options: DetailBackfillOptions = {}
): Promise<DetailBackfillSummary> {
  const supabase = getSupabaseConfig(env);
  if (!supabase) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for detail backfill.");
  }

  const limit = Math.min(Math.max(options.limit ?? 50, 1), MAX_LIMIT);
  const userAgent = options.userAgent ?? env.INGEST_USER_AGENT ?? DEFAULT_USER_AGENT;
  const summary: DetailBackfillSummary = {
    fetched_urls: 0,
    updated_candidates: 0,
    marked_complete: 0,
    still_pending: 0,
    errors: 0,
    skipped_no_url: 0,
    dry_run: options.dryRun ?? false
  };

  const params = new URLSearchParams({
    select: "id,source,title,normalized_event,detail_page_url",
    detail_status: "eq.pending",
    status: "in.(awaiting_enrichment,pending_review,needs_changes)",
    order: "updated_at.asc",
    limit: String(limit)
  });
  if (options.sourceFilter) {
    params.set("source", `eq.${options.sourceFilter}`);
  }

  const rows = await supabaseFetch<DetailBackfillRow[]>(
    supabase,
    `/rest/v1/event_candidates?${params}`
  );

  const byUrl = new Map<string, DetailBackfillRow[]>();
  for (const row of rows) {
    const url = row.detail_page_url?.trim();
    if (!url?.startsWith("http")) {
      summary.skipped_no_url += 1;
      continue;
    }
    const bucket = byUrl.get(url) ?? [];
    bucket.push(row);
    byUrl.set(url, bucket);
  }

  const urlTotal = byUrl.size;
  const rowTotal = rows.length - summary.skipped_no_url;

  console.log(
    `[ingest] detail backfill: ${rowTotal} pending row(s), ${urlTotal} unique URL(s)${options.sourceFilter ? `, source ${options.sourceFilter}` : ""}${options.dryRun ? ", dry-run" : ""}`
  );

  let urlIndex = 0;
  let candidatesProcessed = 0;

  for (const [url, bucket] of byUrl) {
    urlIndex += 1;
    const source = bucket[0]?.source;
    if (!source) {
      continue;
    }

    const sampleTitle = bucket[0]?.title ?? url;

    try {
      summary.fetched_urls += 1;
      const html = options.dryRun ? "" : await fetchDetailHtml(url, userAgent);
      const parsed = options.dryRun ? null : parseDetailForSource(source, html);

      if (options.dryRun) {
        console.log(formatDetailBackfillUrlLine(urlIndex, urlTotal, sampleTitle, bucket.length, bucket.length));
        summary.updated_candidates += bucket.length;
        summary.marked_complete += bucket.length;
        candidatesProcessed += bucket.length;
        continue;
      }

      if (!parsed || isRedirectErrorPage(html)) {
        summary.errors += 1;
        summary.still_pending += bucket.length;
        candidatesProcessed += bucket.length;
        console.log(
          `[ingest] detail backfill ${urlIndex}/${urlTotal}: parse failed for "${sampleTitle}" (${bucket.length} row(s) still pending)`
        );
        continue;
      }

      let urlMarkedComplete = 0;

      for (const row of bucket) {
        candidatesProcessed += 1;

        let merged =
          source === "api:visitfresnocounty"
            ? finalizeVisitFresnoDetailMerge(row.normalized_event, parsed)
            : { ...row.normalized_event, ...parsed };

        if (source === "api:visitfresnocounty" && !merged.seriesListingRecId?.trim()) {
          const recid = listingRecIdFromVisitFresnoUrl(url);
          if (recid) {
            merged = { ...merged, seriesListingRecId: recid };
          }
        }

        const detail = resolveCandidateDetailFields(merged);
        const wasComplete = detail.detail_status === "complete";

        await supabaseFetch(supabase, `/rest/v1/event_candidates?id=eq.${row.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            normalized_event: merged,
            detail_status: detail.detail_status,
            detail_page_url: detail.detail_page_url,
            updated_at: new Date().toISOString()
          })
        });

        summary.updated_candidates += 1;
        if (wasComplete) {
          summary.marked_complete += 1;
          urlMarkedComplete += 1;
        } else {
          summary.still_pending += 1;
        }
      }

      console.log(formatDetailBackfillUrlLine(urlIndex, urlTotal, sampleTitle, bucket.length, urlMarkedComplete));
    } catch (error) {
      summary.errors += 1;
      summary.still_pending += bucket.length;
      candidatesProcessed += bucket.length;
      const message = error instanceof Error ? error.message : "detail fetch failed";
      console.log(
        `[ingest] detail backfill ${urlIndex}/${urlTotal}: error for "${sampleTitle}" — ${message} (${bucket.length} row(s) still pending)`
      );
    }

    if (!options.dryRun) {
      await sleep(DETAIL_DELAY_MS);
    }
  }

  console.log(
    `[ingest] detail backfill done: urls=${summary.fetched_urls}/${urlTotal}, candidates=${candidatesProcessed}/${rowTotal}, marked_complete=${summary.marked_complete}, still_pending=${summary.still_pending}, errors=${summary.errors}`
  );

  return summary;
}
