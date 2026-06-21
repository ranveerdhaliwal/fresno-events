import type {
  CandidateBulkDeleteResponse,
  CandidateBulkPriorityResponse,
  CandidateBulkRejectResponse,
  CandidateDetailStatus,
  EventbriteDetailStatus,
  EventCandidate,
  EventCandidateStatus,
  EventCandidateTabCounts,
  NormalizedEvent
} from "@fresno-events/shared";

import type { Env } from "@/env";
import { toEventSource } from "@/lib/event-source";
import { clampSuggestedPriorityForOrganicEvent, EVENT_PRIORITY_DEFAULT } from "@fresno-events/shared";
import { partitionCandidatesForDelete } from "@/routes/review-delete.utils";
import { candidateSelect } from "@/routes/review.constants";
import { parseContentRangeTotal, toCandidateStatus, toRecord } from "@/routes/review-mappers.utils";
import { getSupabaseServiceConfigOrThrow, supabaseReviewRequest } from "@/routes/review-supabase.utils";
import type { CandidatePatch, SupabaseCandidateRow } from "@/routes/review.types";

function toDetailStatus(raw: string): CandidateDetailStatus {
  return raw === "complete" ? "complete" : "pending";
}

function toEventbriteDetailStatus(raw: string | null): EventbriteDetailStatus | null {
  if (raw === "fetched" || raw === "blocked" || raw === "error") {
    return raw;
  }
  return null;
}

export function mapCandidateRow(row: SupabaseCandidateRow): EventCandidate {
  return {
    id: row.id,
    source: toEventSource(row.source),
    sourceEventId: row.source_event_id,
    title: row.title,
    venueName: row.venue_name,
    startTs: row.start_ts,
    normalizedEvent: row.normalized_event as NormalizedEvent,
    rawPayload: toRecord(row.raw_payload),
    dedupeHash: row.dedupe_hash,
    confidenceScore: row.confidence_score,
    ...(row.suggested_priority !== null ? { suggestedPriority: row.suggested_priority } : {}),
    status: toCandidateStatus(row.status) ?? "pending_review",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.run_id ? { runId: row.run_id } : {}),
    ...(row.source_url ? { sourceUrl: row.source_url } : {}),
    ...(row.ticket_url ? { ticketUrl: row.ticket_url } : {}),
    detailStatus: toDetailStatus(row.detail_status),
    ...(row.detail_page_url ? { detailPageUrl: row.detail_page_url } : {}),
    eventbriteDetailStatus: toEventbriteDetailStatus(row.eventbrite_detail_status),
    ...(row.review_notes ? { reviewNotes: row.review_notes } : {}),
    ...(row.reviewed_at ? { reviewedAt: row.reviewed_at } : {}),
    ...(row.reviewed_by ? { reviewedBy: row.reviewed_by } : {}),
    ...(row.matched_event_id ? { matchedEventId: row.matched_event_id } : {}),
    occurrenceId: row.occurrence_id,
    ...(row.occurrence_key ? { occurrenceKey: row.occurrence_key } : {}),
    ...(row.canonical_candidate_id ? { canonicalCandidateId: row.canonical_candidate_id } : {})
  };
}

export async function attachPublishedPriorities(
  env: Env,
  candidates: EventCandidate[]
): Promise<EventCandidate[]> {
  const eventIds = [
    ...new Set(
      candidates
        .map((candidate) => candidate.matchedEventId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  ];

  if (eventIds.length === 0) {
    return candidates;
  }

  const params = new URLSearchParams({
    select: "id,priority",
    id: `in.(${eventIds.join(",")})`
  });
  const rows = await supabaseReviewRequest<Array<{ id: string; priority: number | null }>>(
    env,
    `/rest/v1/events?${params}`
  );
  const priorityByEventId = new Map(
    rows.map((row) => [row.id, row.priority ?? EVENT_PRIORITY_DEFAULT] as const)
  );

  return candidates.map((candidate) => {
    if (!candidate.matchedEventId) {
      return candidate;
    }
    const publishedPriority = priorityByEventId.get(candidate.matchedEventId);
    return publishedPriority !== undefined ? { ...candidate, publishedPriority } : candidate;
  });
}

export async function attachPublishedHeroImages(
  env: Env,
  candidates: EventCandidate[]
): Promise<EventCandidate[]> {
  const needsFallback = candidates.filter(
    (candidate) =>
      candidate.matchedEventId &&
      !candidate.normalizedEvent.imageUrl?.trim()
  );
  if (needsFallback.length === 0) {
    return candidates;
  }

  const eventIds = [
    ...new Set(
      needsFallback
        .map((candidate) => candidate.matchedEventId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  ];

  const params = new URLSearchParams({
    select: "id,hero_image:images(cdn_url)",
    id: `in.(${eventIds.join(",")})`
  });
  const rows = await supabaseReviewRequest<
    Array<{ id: string; hero_image: { cdn_url: string } | null }>
  >(env, `/rest/v1/events?${params}`);
  const heroByEventId = new Map(
    rows
      .map((row) => [row.id, row.hero_image?.cdn_url?.trim() ?? ""] as const)
      .filter((entry): entry is [string, string] => entry[1].length > 0)
  );

  return candidates.map((candidate) => {
    if (!candidate.matchedEventId || candidate.normalizedEvent.imageUrl?.trim()) {
      return candidate;
    }
    const publishedHeroImageUrl = heroByEventId.get(candidate.matchedEventId);
    return publishedHeroImageUrl
      ? { ...candidate, publishedHeroImageUrl }
      : candidate;
  });
}

export async function getCandidate(env: Env, id: string) {
  const params = new URLSearchParams({ select: candidateSelect, id: `eq.${id}`, limit: "1" });
  const rows = await supabaseReviewRequest<SupabaseCandidateRow[]>(
    env,
    `/rest/v1/event_candidates?${params}`
  );
  return rows[0] ? mapCandidateRow(rows[0]) : null;
}

export async function updateCandidate(env: Env, id: string, patch: CandidatePatch) {
  const params = new URLSearchParams({ id: `eq.${id}` });
  const rows = await supabaseReviewRequest<SupabaseCandidateRow[]>(
    env,
    `/rest/v1/event_candidates?${params}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
    }
  );

  return rows[0] ? mapCandidateRow(rows[0]) : null;
}

export async function fetchCandidatesByOccurrenceId(
  env: Env,
  occurrenceId: string,
  excludeId?: string,
  occurrenceKey?: string | null
): Promise<EventCandidate[]> {
  const params = new URLSearchParams({
    select: candidateSelect,
    occurrence_id: `eq.${occurrenceId}`,
    order: "source.asc",
    limit: "50"
  });
  if (occurrenceKey) {
    params.set("occurrence_key", `eq.${occurrenceKey}`);
  }

  const rows = await supabaseReviewRequest<SupabaseCandidateRow[]>(
    env,
    `/rest/v1/event_candidates?${params}`
  );
  return rows.filter((row) => row.id !== excludeId).map(mapCandidateRow);
}

function normalizeListingUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    if (parsed.searchParams.get("format") === "ical") {
      parsed.search = "";
    }
    return parsed.href.replace(/\/+$/, "");
  } catch {
    return url.replace(/\/+$/, "");
  }
}

export async function fetchCandidatesByListingUrl(
  env: Env,
  listingUrl: string,
  excludeId: string,
  options?: { status?: EventCandidateStatus; statuses?: EventCandidateStatus[] }
): Promise<EventCandidate[]> {
  const canonical = normalizeListingUrl(listingUrl);
  const withTrailingSlash = `${canonical}/`;
  const quoted = `"${canonical.replace(/"/g, '""')}"`;
  const quotedSlash = `"${withTrailingSlash.replace(/"/g, '""')}"`;
  const params = new URLSearchParams({
    select: candidateSelect,
    or: `(detail_page_url.eq.${quoted},detail_page_url.eq.${quotedSlash},source_url.eq.${quoted},source_url.eq.${quotedSlash},normalized_event->>externalUrl.eq.${quoted},normalized_event->>externalUrl.eq.${quotedSlash})`,
    id: `neq.${excludeId}`,
    order: "start_ts.asc",
    limit: "40"
  });
  if (options?.statuses && options.statuses.length > 0) {
    params.set("status", `in.(${options.statuses.join(",")})`);
  } else if (options?.status) {
    params.set("status", `eq.${options.status}`);
  }

  const rows = await supabaseReviewRequest<SupabaseCandidateRow[]>(
    env,
    `/rest/v1/event_candidates?${params}`
  );
  return rows.map(mapCandidateRow);
}

export async function fetchCandidatesNearStartTs(
  env: Env,
  startTs: string,
  excludeId: string
): Promise<EventCandidate[]> {
  const instant = new Date(startTs);
  if (Number.isNaN(instant.getTime())) {
    return [];
  }

  const windowMs = 36 * 60 * 60 * 1000;
  const from = new Date(instant.getTime() - windowMs).toISOString();
  const to = new Date(instant.getTime() + windowMs).toISOString();
  const params = new URLSearchParams({
    select: candidateSelect,
    and: `(start_ts.gte.${from},start_ts.lte.${to})`,
    status: "in.(awaiting_enrichment,pending_review,needs_changes,approved)",
    id: `neq.${excludeId}`,
    limit: "200"
  });

  const rows = await supabaseReviewRequest<SupabaseCandidateRow[]>(
    env,
    `/rest/v1/event_candidates?${params}`
  );
  return rows.map(mapCandidateRow);
}

export async function fetchCandidatesBySeriesId(
  env: Env,
  seriesId: string,
  excludeId: string,
  options?: { limit?: number }
): Promise<EventCandidate[]> {
  const params = new URLSearchParams({
    select: candidateSelect,
    "normalized_event->>seriesId": `eq.${seriesId}`,
    status: "in.(pending_review,approved)",
    canonical_candidate_id: "is.null",
    id: `neq.${excludeId}`,
    order: "start_ts.asc",
    limit: String(options?.limit ?? 30)
  });

  const rows = await supabaseReviewRequest<SupabaseCandidateRow[]>(
    env,
    `/rest/v1/event_candidates?${params}`
  );
  return rows.map(mapCandidateRow);
}

const REVIEW_TAB_COUNT_STATUSES = [
  "pending_review",
  "needs_changes",
  "approved",
  "rejected"
] as const satisfies readonly EventCandidateStatus[];

/** Primaries only — linked secondaries are not actionable in New/Updates queues. */
export function applyReviewQueueListFilters(params: URLSearchParams, status: EventCandidateStatus): void {
  if (status === "pending_review" || status === "needs_changes") {
    params.set("canonical_candidate_id", "is.null");
  }
}

export async function countCandidatesByStatus(env: Env, status: EventCandidateStatus): Promise<number> {
  const params = new URLSearchParams({
    select: "id",
    status: `eq.${status}`,
    limit: "0"
  });
  applyReviewQueueListFilters(params, status);

  const { url, key } = getSupabaseServiceConfigOrThrow(env);
  const response = await fetch(`${url}/rest/v1/event_candidates?${params}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact"
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase count failed with ${response.status}: ${body}`);
  }

  const total = parseContentRangeTotal(response.headers.get("content-range"));
  return total ?? 0;
}

export async function countCandidateTabTotals(env: Env): Promise<EventCandidateTabCounts> {
  const [pending_review, needs_changes, approved, rejected] = await Promise.all(
    REVIEW_TAB_COUNT_STATUSES.map((status) => countCandidatesByStatus(env, status))
  );
  return { pending_review, needs_changes, approved, rejected };
}

export async function listAllCandidatesByStatus(
  env: Env,
  status: EventCandidateStatus,
  maxLimit?: number
): Promise<EventCandidate[]> {
  const pageSize = 500;
  const all: EventCandidate[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      select: candidateSelect,
      status: `eq.${status}`,
      order: status === "approved" || status === "rejected" ? "reviewed_at.desc" : "created_at.asc",
      limit: String(pageSize),
      offset: String(offset)
    });
    applyReviewQueueListFilters(params, status);
    const rows = await supabaseReviewRequest<SupabaseCandidateRow[]>(
      env,
      `/rest/v1/event_candidates?${params}`
    );

    if (rows.length === 0) {
      break;
    }

    all.push(...rows.map(mapCandidateRow));

    if (maxLimit !== undefined && all.length >= maxLimit) {
      return all.slice(0, maxLimit);
    }

    if (rows.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return all;
}

export async function deleteCandidates(
  env: Env,
  ids: string[],
  options: { force: boolean }
): Promise<CandidateBulkDeleteResponse> {
  const uniqueIds = [...new Set(ids)];
  const params = new URLSearchParams({
    select: "id,status",
    id: `in.(${uniqueIds.join(",")})`
  });
  const rows = await supabaseReviewRequest<Array<{ id: string; status: string }>>(
    env,
    `/rest/v1/event_candidates?${params}`
  );
  const { toDelete, skipped } = partitionCandidatesForDelete(uniqueIds, rows, options.force);

  if (toDelete.length > 0) {
    const deleteParams = new URLSearchParams({ id: `in.(${toDelete.join(",")})` });
    await supabaseReviewRequest(env, `/rest/v1/event_candidates?${deleteParams}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" }
    });
  }

  return { deleted: toDelete.length, skipped };
}

export async function bulkUpdateSuggestedPriority(
  env: Env,
  ids: string[],
  priority: number
): Promise<CandidateBulkPriorityResponse> {
  const clamped = clampSuggestedPriorityForOrganicEvent(priority, false);
  const uniqueIds = [...new Set(ids)];
  const failed: Array<{ id: string; message: string }> = [];
  let updated = 0;

  for (const id of uniqueIds) {
    try {
      const row = await updateCandidate(env, id, { suggested_priority: clamped });
      if (row) {
        updated += 1;
      } else {
        failed.push({ id, message: "not_found" });
      }
    } catch (error) {
      failed.push({
        id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { priority: clamped, updated, failed };
}

export async function bulkRejectCandidates(
  env: Env,
  ids: string[],
  options: { notes?: string; reviewedBy?: string } = {}
): Promise<CandidateBulkRejectResponse> {
  const uniqueIds = [...new Set(ids)];
  const failed: Array<{ id: string; message: string }> = [];
  let rejected = 0;
  const reviewedAt = new Date().toISOString();
  const reviewedBy = options.reviewedBy ?? "admin";
  const reviewNotes = options.notes ?? null;

  for (const id of uniqueIds) {
    try {
      const row = await updateCandidate(env, id, {
        status: "rejected",
        review_notes: reviewNotes,
        reviewed_by: reviewedBy,
        reviewed_at: reviewedAt
      });
      if (row) {
        rejected += 1;
      } else {
        failed.push({ id, message: "not_found" });
      }
    } catch (error) {
      failed.push({
        id,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { rejected, failed };
}
