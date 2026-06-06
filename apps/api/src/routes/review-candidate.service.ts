import type {
  CandidateBulkDeleteResponse,
  CandidateDetailStatus,
  EventCandidate,
  EventCandidateStatus,
  NormalizedEvent
} from "@fresno-events/shared";

import type { Env } from "@/env";
import { toEventSource } from "@/lib/event-source";
import { partitionCandidatesForDelete } from "@/routes/review-delete.utils";
import { candidateSelect } from "@/routes/review.constants";
import { toCandidateStatus, toRecord } from "@/routes/review-mappers.utils";
import { supabaseReviewRequest } from "@/routes/review-supabase.utils";
import type { CandidatePatch, SupabaseCandidateRow } from "@/routes/review.types";

function toDetailStatus(raw: string): CandidateDetailStatus {
  return raw === "complete" ? "complete" : "pending";
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
    ...(row.review_notes ? { reviewNotes: row.review_notes } : {}),
    ...(row.reviewed_at ? { reviewedAt: row.reviewed_at } : {}),
    ...(row.reviewed_by ? { reviewedBy: row.reviewed_by } : {}),
    ...(row.matched_event_id ? { matchedEventId: row.matched_event_id } : {}),
    occurrenceId: row.occurrence_id,
    ...(row.canonical_candidate_id ? { canonicalCandidateId: row.canonical_candidate_id } : {})
  };
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
  excludeId?: string
): Promise<EventCandidate[]> {
  const params = new URLSearchParams({
    select: candidateSelect,
    occurrence_id: `eq.${occurrenceId}`,
    order: "source.asc",
    limit: "50"
  });

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
      order: "created_at.asc",
      limit: String(pageSize),
      offset: String(offset)
    });
    if (status === "pending_review") {
      params.set("canonical_candidate_id", "is.null");
    }
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
