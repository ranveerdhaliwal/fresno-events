import type { NormalizedEvent } from "@fresno-events/shared";

import type { IngestEnv } from "@/env";
import { sleep } from "@/lib/sleep";
import {
  DEFAULT_EVENTBRITE_DETAIL_CIRCUIT_THRESHOLD,
  DEFAULT_EVENTBRITE_DETAIL_DELAY_MS,
  DEFAULT_EVENTBRITE_DETAIL_JITTER_MS,
  fetchAndParseEventbriteDetail,
  jitteredDelayMs,
  resolveEventbriteDetailUserAgent
} from "@/scrapers/eventbrite-detail-fetch.utils";
import {
  buildEventbriteFetchUnits,
  detailFieldsFromRow,
  mergeEventbriteDetailForSeriesRow,
  pickSeriesRepresentativeRow,
  rowSeriesId,
  splitEventbriteSeriesDescription,
  type EventbriteBackfillRowLike,
  type EventbriteFetchUnit
} from "@/scrapers/eventbrite-detail-series.utils";
import {
  normalizeEventbriteEventUrl,
  resolveEventbriteUrlFromEvent,
  type EventbriteDetailFields
} from "@/scrapers/eventbrite-detail.utils";
import { getSupabaseConfig, supabaseFetch } from "@/sources";

const MAX_LIMIT = 20;
const ACTIVE_STATUSES = "in.(awaiting_enrichment,pending_review,needs_changes,approved,duplicate)";
const ROW_SELECT = "id,source,title,normalized_event,eventbrite_detail_status";

export type EventbriteDetailStatus = "fetched" | "blocked" | "error";

export interface EventbriteDetailBackfillSummary {
  candidates_considered: number;
  urls_fetched: number;
  series_groups: number;
  series_propagated: number;
  updated_candidates: number;
  marked_fetched: number;
  marked_blocked: number;
  marked_error: number;
  skipped_no_url: number;
  skipped_already_fetched: number;
  circuit_open: boolean;
  dry_run: boolean;
  errors: number;
}

interface EventbriteBackfillRow extends EventbriteBackfillRowLike {
  source: string;
}

export interface EventbriteDetailBackfillOptions {
  dryRun?: boolean;
  limit?: number;
  delayMs?: number;
  jitterMs?: number;
  circuitThreshold?: number;
  retryBlocked?: boolean;
  candidateId?: string;
  url?: string;
  matchCandidate?: boolean;
  userAgent?: string;
  sourceFilter?: string;
}

function rowEventbriteUrl(row: EventbriteBackfillRowLike): string | null {
  const raw = resolveEventbriteUrlFromEvent(row.normalized_event);
  if (!raw) {
    return null;
  }
  return normalizeEventbriteEventUrl(raw) ?? raw;
}

function emptySummary(dryRun: boolean): EventbriteDetailBackfillSummary {
  return {
    candidates_considered: 0,
    urls_fetched: 0,
    series_groups: 0,
    series_propagated: 0,
    updated_candidates: 0,
    marked_fetched: 0,
    marked_blocked: 0,
    marked_error: 0,
    skipped_no_url: 0,
    skipped_already_fetched: 0,
    circuit_open: false,
    dry_run: dryRun,
    errors: 0
  };
}

function isEligibleRow(row: EventbriteBackfillRow, retryBlocked: boolean): boolean {
  const status = row.eventbrite_detail_status;
  if (status === "fetched") {
    // Re-enrich when a promote rescrape dropped Eventbrite image/price but status stayed fetched.
    return !row.normalized_event.imageUrl?.trim() && Boolean(rowEventbriteUrl(row));
  }
  if (status === "blocked" && !retryBlocked) {
    return false;
  }
  return Boolean(rowEventbriteUrl(row));
}

function appendEbBackfillQueryFilters(
  params: URLSearchParams,
  options: { retryBlocked: boolean }
): void {
  const ebOr =
    "or(source_event_id.like.eb:*,normalized_event->>externalUrl.ilike.*eventbrite.com*,normalized_event->>ticketUrl.ilike.*eventbrite.com*)";
  if (options.retryBlocked) {
    params.set("and", `(${ebOr})`);
    return;
  }
  const statusOr =
    "or(eventbrite_detail_status.is.null,eventbrite_detail_status.eq.error,eventbrite_detail_status.eq.fetched)";
  params.set("and", `(${ebOr},${statusOr})`);
}

async function fetchCandidateRows(
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
  options: EventbriteDetailBackfillOptions
): Promise<EventbriteBackfillRow[]> {
  if (options.candidateId) {
    const params = new URLSearchParams({
      select: ROW_SELECT,
      id: `eq.${options.candidateId}`,
      limit: "1"
    });
    return supabaseFetch<EventbriteBackfillRow[]>(config, `/rest/v1/event_candidates?${params}`);
  }

  const limit = Math.min(Math.max(options.limit ?? 5, 1), MAX_LIMIT);
  const params = new URLSearchParams({
    select: ROW_SELECT,
    status: ACTIVE_STATUSES,
    order: "updated_at.asc",
    limit: String(Math.min(Math.max(limit * 25, 100), 500))
  });

  appendEbBackfillQueryFilters(params, { retryBlocked: options.retryBlocked ?? false });

  const rows = await supabaseFetch<EventbriteBackfillRow[]>(
    config,
    `/rest/v1/event_candidates?${params}`
  );

  return rows.filter((row) => {
    if (options.sourceFilter && row.source !== options.sourceFilter) {
      return false;
    }
    return isEligibleRow(row, options.retryBlocked ?? false);
  });
}

async function fetchSeriesRowsByStatus(
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
  seriesId: string,
  options: { retryBlocked: boolean; fetchedOnly?: boolean }
): Promise<EventbriteBackfillRow[]> {
  const params = new URLSearchParams({
    select: ROW_SELECT,
    status: ACTIVE_STATUSES,
    "normalized_event->>seriesId": `eq.${seriesId}`,
    limit: "100"
  });

  if (options.fetchedOnly) {
    params.set("eventbrite_detail_status", "eq.fetched");
  } else if (!options.retryBlocked) {
    params.set("or", "(eventbrite_detail_status.is.null,eventbrite_detail_status.eq.error)");
  }

  const rows = await supabaseFetch<EventbriteBackfillRow[]>(
    config,
    `/rest/v1/event_candidates?${params}`
  );

  if (options.fetchedOnly) {
    return rows.filter((row) => row.eventbrite_detail_status === "fetched" && Boolean(detailFieldsFromRow(row)));
  }

  return rows.filter((row) => isEligibleRow(row, options.retryBlocked));
}

async function fetchSeriesMemberCount(
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
  seriesId: string
): Promise<number> {
  const params = new URLSearchParams({
    select: "id",
    status: ACTIVE_STATUSES,
    "normalized_event->>seriesId": `eq.${seriesId}`,
    limit: "100"
  });
  const rows = await supabaseFetch<Array<{ id: string }>>(
    config,
    `/rest/v1/event_candidates?${params}`
  );
  return rows.length;
}

async function expandRowsWithSeriesSiblings(
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
  rows: EventbriteBackfillRow[],
  options: EventbriteDetailBackfillOptions
): Promise<EventbriteBackfillRow[]> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const seriesIds = new Set<string>();

  for (const row of rows) {
    const seriesId = rowSeriesId(row.normalized_event);
    if (seriesId) {
      seriesIds.add(seriesId);
    }
  }

  for (const seriesId of seriesIds) {
    const memberCount = await fetchSeriesMemberCount(config, seriesId);
    if (memberCount < 2) {
      continue;
    }

    const siblings = await fetchSeriesRowsByStatus(config, seriesId, {
      retryBlocked: options.retryBlocked ?? false
    });
    for (const sibling of siblings) {
      byId.set(sibling.id, sibling);
    }
  }

  return [...byId.values()];
}

async function buildSeriesMemberCounts(
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
  rows: EventbriteBackfillRow[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const seriesIds = new Set<string>();

  for (const row of rows) {
    const seriesId = rowSeriesId(row.normalized_event);
    if (seriesId) {
      seriesIds.add(seriesId);
    }
  }

  await Promise.all(
    [...seriesIds].map(async (seriesId) => {
      counts.set(seriesId, await fetchSeriesMemberCount(config, seriesId));
    })
  );

  return counts;
}

async function patchCandidate(
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
  row: EventbriteBackfillRowLike,
  merged: NormalizedEvent,
  status: EventbriteDetailStatus | null,
  dryRun: boolean
): Promise<void> {
  if (dryRun) {
    return;
  }

  const body: Record<string, unknown> = {
    normalized_event: merged,
    updated_at: new Date().toISOString()
  };

  if (status) {
    body.eventbrite_detail_status = status;
    body.eventbrite_detail_fetched_at = new Date().toISOString();
  }

  await supabaseFetch(config, `/rest/v1/event_candidates?id=eq.${row.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(body)
  });
}

async function findRowsByUrl(
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
  url: string
): Promise<EventbriteBackfillRow[]> {
  const normalized = normalizeEventbriteEventUrl(url) ?? url;
  const params = new URLSearchParams({
    select: ROW_SELECT,
    status: ACTIVE_STATUSES,
    limit: "200"
  });
  const rows = await supabaseFetch<EventbriteBackfillRow[]>(
    config,
    `/rest/v1/event_candidates?${params}`
  );
  return rows.filter((row) => rowEventbriteUrl(row) === normalized);
}

async function resolveCachedSeriesDetail(
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
  unit: EventbriteFetchUnit
): Promise<EventbriteDetailFields | null> {
  if (unit.kind !== "series" || !unit.seriesId) {
    return null;
  }

  const fetchedRows = await fetchSeriesRowsByStatus(config, unit.seriesId, {
    retryBlocked: true,
    fetchedOnly: true
  });
  if (fetchedRows.length === 0) {
    return null;
  }
  const source = pickSeriesRepresentativeRow(fetchedRows);
  return detailFieldsFromRow(source);
}

async function applyDetailToUnitRows(
  config: NonNullable<ReturnType<typeof getSupabaseConfig>>,
  unit: EventbriteFetchUnit,
  detail: EventbriteDetailFields,
  dryRun: boolean,
  summary: EventbriteDetailBackfillSummary,
  fromFreshFetch: boolean
): Promise<void> {
  const split = splitEventbriteSeriesDescription(detail.descriptionText ?? "");
  const mode = unit.kind === "series" ? split.mode : "full";

  for (const row of unit.rows) {
    const merged = mergeEventbriteDetailForSeriesRow(row.normalized_event, detail, {
      mode,
      isRepresentative: mode === "full" || (fromFreshFetch && row.id === unit.representativeRowId)
    });
    const descriptionChanged =
      merged.descriptionText?.trim() !== row.normalized_event.descriptionText?.trim();

    await patchCandidate(config, row, merged, "fetched", dryRun);
    summary.updated_candidates += 1;

    if (descriptionChanged) {
      summary.marked_fetched += 1;
    }

    if (unit.kind === "series" && row.id !== unit.representativeRowId && descriptionChanged) {
      summary.series_propagated += 1;
    }
  }
}

export async function runEventbriteDetailBackfill(
  env: Pick<IngestEnv, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY" | "USER_AGENT">,
  options: EventbriteDetailBackfillOptions = {}
): Promise<EventbriteDetailBackfillSummary> {
  const config = getSupabaseConfig(env);
  if (!config) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Eventbrite detail backfill.");
  }

  const limit = Math.min(Math.max(options.limit ?? 5, 1), MAX_LIMIT);
  const delayMs = options.delayMs ?? DEFAULT_EVENTBRITE_DETAIL_DELAY_MS;
  const jitterMs = options.jitterMs ?? DEFAULT_EVENTBRITE_DETAIL_JITTER_MS;
  const circuitThreshold = options.circuitThreshold ?? DEFAULT_EVENTBRITE_DETAIL_CIRCUIT_THRESHOLD;
  const userAgent = resolveEventbriteDetailUserAgent(options.userAgent ?? env.USER_AGENT);
  const dryRun = options.dryRun ?? false;
  const summary = emptySummary(dryRun);

  const url = options.url?.trim();
  const previewOnly = Boolean(url) && !options.matchCandidate && !options.candidateId;

  if (previewOnly && url) {
    summary.urls_fetched += 1;
    const outcome = await fetchAndParseEventbriteDetail(url, { userAgent });
    if (outcome.kind === "ok") {
      const descriptionText = outcome.detail.descriptionText ?? "";
      const split = splitEventbriteSeriesDescription(descriptionText);
      console.log(
        JSON.stringify({
          event: "eventbrite_detail_parse_preview",
          url,
          description_length: descriptionText.length,
          has_image: Boolean(outcome.detail.imageUrl),
          price_min: outcome.detail.priceMin ?? null,
          price_max: outcome.detail.priceMax ?? null,
          series_mode: split.mode,
          description_preview: descriptionText.slice(0, 400)
        })
      );
    } else {
      console.log(
        JSON.stringify({
          event: "eventbrite_detail_parse_preview",
          url,
          outcome: outcome.kind,
          message: outcome.message
        })
      );
      summary.errors += 1;
    }
    return summary;
  }

  let rows: EventbriteBackfillRow[] = [];

  if (options.candidateId) {
    rows = await fetchCandidateRows(config, options);
  } else if (url && options.matchCandidate) {
    rows = await findRowsByUrl(config, url);
  } else {
    rows = await fetchCandidateRows(config, options);
  }

  rows = await expandRowsWithSeriesSiblings(config, rows, options);
  summary.candidates_considered = rows.length;

  const seriesMemberCounts = await buildSeriesMemberCounts(config, rows);
  const fetchUnits = buildEventbriteFetchUnits(rows, rowEventbriteUrl, seriesMemberCounts);
  summary.series_groups = fetchUnits.filter((unit) => unit.kind === "series").length;

  let consecutiveFailures = 0;
  let unitsProcessed = 0;

  for (const unit of fetchUnits) {
    if (unitsProcessed >= limit) {
      break;
    }
    if (consecutiveFailures >= circuitThreshold) {
      summary.circuit_open = true;
      console.log(
        JSON.stringify({
          event: "eventbrite_detail_circuit_open",
          consecutive_failures: consecutiveFailures,
          threshold: circuitThreshold
        })
      );
      break;
    }

    unitsProcessed += 1;

    const label =
      unit.kind === "series"
        ? `series "${unit.rows[0]?.title ?? unit.seriesId}" (${unit.rows.length} row(s))`
        : `"${unit.rows[0]?.title ?? unit.url}" (${unit.rows.length} row(s))`;

    console.log(
      `[ingest] eventbrite detail ${unitsProcessed}/${limit}: ${label}${dryRun ? " · dry-run" : ""}`
    );

    if (dryRun) {
      summary.urls_fetched += 1;
      summary.updated_candidates += unit.rows.length;
      summary.marked_fetched += unit.rows.length;
      if (unit.kind === "series" && unit.rows.length > 1) {
        summary.series_propagated += unit.rows.length - 1;
      }
      continue;
    }

    const cachedDetail = await resolveCachedSeriesDetail(config, unit);
    if (cachedDetail) {
      summary.skipped_already_fetched += 1;
      await applyDetailToUnitRows(config, unit, cachedDetail, dryRun, summary, false);
      console.log(
        JSON.stringify({
          event: "eventbrite_detail_series_cached",
          series_id: unit.seriesId,
          rows: unit.rows.length,
          description_length: cachedDetail.descriptionText?.length ?? 0
        })
      );
      continue;
    }

    summary.urls_fetched += 1;
    const outcome = await fetchAndParseEventbriteDetail(unit.url, { userAgent });

    if (outcome.kind === "ok") {
      consecutiveFailures = 0;
      await applyDetailToUnitRows(config, unit, outcome.detail, dryRun, summary, true);

      const outcomeDescription = outcome.detail.descriptionText ?? "";
      console.log(
        JSON.stringify({
          event: "eventbrite_detail_fetched",
          url: unit.url,
          kind: unit.kind,
          series_id: unit.seriesId,
          series_mode: splitEventbriteSeriesDescription(outcomeDescription).mode,
          description_length: outcomeDescription.length,
          price_min: outcome.detail.priceMin ?? null,
          price_max: outcome.detail.priceMax ?? null,
          rows: unit.rows.length,
          propagated: unit.kind === "series" ? Math.max(unit.rows.length - 1, 0) : 0
        })
      );
    } else if (outcome.kind === "blocked") {
      consecutiveFailures += 1;
      summary.errors += 1;

      for (const row of unit.rows) {
        await patchCandidate(config, row, row.normalized_event, "blocked", dryRun);
        summary.marked_blocked += 1;
      }

      console.log(JSON.stringify({ event: "eventbrite_detail_blocked", url: unit.url, message: outcome.message }));
    } else {
      consecutiveFailures += 1;
      summary.errors += 1;

      for (const row of unit.rows) {
        await patchCandidate(config, row, row.normalized_event, "error", dryRun);
        summary.marked_error += 1;
      }

      console.log(JSON.stringify({ event: "eventbrite_detail_error", url: unit.url, message: outcome.message }));
    }

    if (unitsProcessed < limit && unitsProcessed < fetchUnits.length) {
      await sleep(jitteredDelayMs(delayMs, jitterMs));
    }
  }

  console.log(
    `[ingest] eventbrite detail done: urls=${summary.urls_fetched}, series=${summary.series_groups}, propagated=${summary.series_propagated}, updated=${summary.updated_candidates}, fetched=${summary.marked_fetched}, blocked=${summary.marked_blocked}, error=${summary.marked_error}, circuit_open=${summary.circuit_open}`
  );

  return summary;
}
