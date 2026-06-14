import type {
  AdminEventListResponse,
  AdminEventPatchBody,
  AdminEventSearchResponse,
  AdminPublishedEventResponse,
  ApiResponse,
  EventCandidate,
  EventCandidateDetailResponse,
  CandidateBulkApproveChangesResponse,
  CandidateBulkApproveResponse,
  CandidateBulkDeleteResponse,
  CandidateBulkPriorityResponse,
  CandidateBulkRejectResponse,
  EventBulkPriorityResponse,
  EventCandidateListResponse,
  EventCandidateTabCounts,
  HomepageSlotsPutBody,
  HomepageSlotsResponse,
  ReviewDecisionResponse,
  ReviewOccurrenceRelinkOpsResponse,
  ReviewPriorityRerankOpsResponse,
  ReviewQueueAuditResponse,
  ReviewVenueAddressBackfillOpsResponse,
  ReviewVenueGeocodeOpsResponse
} from "@fresno-events/shared";

import type {
  ApproveBody,
  BulkApproveBody,
  CandidateStatusFilter,
  RejectBody,
  ReviewQueueTab
} from "./admin-api.types";
import { normalizeOccurrenceRelinkOpsResponse } from "../admin-review/admin-maintenance.utils";

export type { ApproveBody, BulkApproveBody, CandidateStatusFilter, RejectBody, ReviewQueueTab } from "./admin-api.types";

function getApiUrl() {
  const value = import.meta.env.VITE_API_URL?.trim();
  return value ? value : null;
}

export class AdminApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

export function isAdminAuthError(error: unknown): error is AdminApiError {
  return error instanceof AdminApiError && error.status === 401;
}

/** Lightweight check that the token is accepted by the review API. */
export async function verifyAdminToken(token: string): Promise<void> {
  await listCandidates(token, "pending_review", { limit: 1 });
}

export function reviewTabToStatus(tab: ReviewQueueTab): CandidateStatusFilter {
  switch (tab) {
    case "new":
      return "pending_review";
    case "updates":
      return "needs_changes";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
  }
}

export async function fetchPreApproveAudit(token: string) {
  return adminFetch<ReviewQueueAuditResponse>(token, "/review/candidates/pre-approve-audit");
}

export async function runOccurrenceRelinkOps(token: string, dryRun: boolean) {
  const params = new URLSearchParams();
  if (dryRun) {
    params.set("dry_run", "true");
  }
  const query = params.toString();
  return adminFetch<ReviewOccurrenceRelinkOpsResponse>(
    token,
    `/review/ops/occurrence-relink${query ? `?${query}` : ""}`,
    { method: "POST" }
  ).then(normalizeOccurrenceRelinkOpsResponse);
}

export async function runVenueAddressBackfillOps(token: string, dryRun: boolean, source?: string) {
  const params = new URLSearchParams();
  if (dryRun) {
    params.set("dry_run", "true");
  }
  if (source?.trim()) {
    params.set("source", source.trim());
  }
  const query = params.toString();
  return adminFetch<ReviewVenueAddressBackfillOpsResponse>(
    token,
    `/review/ops/venue-address-backfill${query ? `?${query}` : ""}`,
    { method: "POST" }
  );
}

export async function geocodeVenueAddress(
  token: string,
  input: { address: string; city?: string }
): Promise<{ lat: number; lng: number }> {
  const params = new URLSearchParams();
  if (input.address.trim()) {
    params.set("address", input.address.trim());
  }
  if (input.city?.trim()) {
    params.set("city", input.city.trim());
  }
  return adminFetch<{ lat: number; lng: number }>(token, `/review/geocode?${params}`);
}

export interface GeocodeOpsProgress {
  batch: number;
  batchGeocoded: number;
  totalGeocoded: number;
  totalScanned: number;
}

export async function runVenueGeocodeOps(
  token: string,
  options: { dryRun: boolean; onProgress?: (progress: GeocodeOpsProgress) => void }
): Promise<ReviewVenueGeocodeOpsResponse> {
  if (options.dryRun) {
    return adminFetch<ReviewVenueGeocodeOpsResponse>(token, "/review/ops/venue-geocode?dry_run=true", {
      method: "POST"
    });
  }

  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new AdminApiError("VITE_API_URL is not set; cannot reach the review API.", 0);
  }

  const response = await fetch(new URL("/review/ops/venue-geocode?stream=true", apiUrl), {
    method: "POST",
    headers: {
      Accept: "application/x-ndjson",
      "x-admin-token": token
    }
  });

  if (!response.ok) {
    let message = `Geocode failed (${response.status})`;
    try {
      const payload = (await response.json()) as ApiResponse<ReviewVenueGeocodeOpsResponse>;
      if (!payload.ok && payload.error?.message) {
        message = payload.error.message;
      }
    } catch {
      // Keep generic message when body is not JSON.
    }
    throw new AdminApiError(message, response.status);
  }

  if (!response.body) {
    throw new AdminApiError("Geocode stream returned no body.", response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: ReviewVenueGeocodeOpsResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const event = JSON.parse(trimmed) as {
        type: string;
        batch?: number;
        summary?: ReviewVenueGeocodeOpsResponse["summary"];
        total?: ReviewVenueGeocodeOpsResponse["summary"];
      } & ReviewVenueGeocodeOpsResponse;

      if (event.type === "batch" && options.onProgress && event.batch && event.summary && event.total) {
        options.onProgress({
          batch: event.batch,
          batchGeocoded: event.summary.geocoded,
          totalGeocoded: event.total.geocoded,
          totalScanned: event.total.scanned
        });
      }

      if (event.type === "complete") {
        finalResult = {
          dryRun: event.dryRun,
          summary: event.summary,
          message: event.message
        };
      }
    }
  }

  if (!finalResult) {
    throw new AdminApiError("Geocode stream ended without a final result.", 0);
  }

  return finalResult;
}

export async function runPriorityRerankOps(token: string, dryRun: boolean, source?: string) {
  const params = new URLSearchParams();
  if (dryRun) {
    params.set("dry_run", "true");
  }
  if (source?.trim()) {
    params.set("source", source.trim());
  }
  const query = params.toString();
  return adminFetch<ReviewPriorityRerankOpsResponse>(
    token,
    `/review/ops/priority-rerank${query ? `?${query}` : ""}`,
    { method: "POST" }
  );
}

export async function listCandidates(
  token: string,
  status: CandidateStatusFilter,
  opts?: { limit?: number; offset?: number }
) {
  const pageSize = 500;
  const maxItems = opts?.limit ?? 5000;
  const all: EventCandidateListResponse["items"] = [];
  let offset = opts?.offset ?? 0;
  let generatedAt = new Date().toISOString();

  while (all.length < maxItems) {
    const params = new URLSearchParams({
      status,
      limit: String(Math.min(pageSize, maxItems - all.length)),
      offset: String(offset)
    });
    const page = await adminFetch<EventCandidateListResponse>(token, `/review/candidates?${params}`);
    generatedAt = page.generatedAt;
    all.push(...page.items);
    if (page.items.length < pageSize) {
      break;
    }
    offset += page.items.length;
  }

  return {
    items: all,
    generatedAt,
    offset: opts?.offset ?? 0,
    limit: all.length
  } satisfies EventCandidateListResponse;
}

export async function fetchCandidateTabCounts(token: string) {
  return adminFetch<EventCandidateTabCounts>(token, "/review/candidates/counts");
}

export async function linkCandidatesAsSeries(token: string, id: string, otherCandidateId: string) {
  return adminFetch<EventCandidateDetailResponse>(token, `/review/candidates/${encodeURIComponent(id)}/series-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otherCandidateId })
  });
}

export async function unlinkCandidateFromSeries(token: string, id: string, candidateId: string) {
  return adminFetch<EventCandidateDetailResponse>(token, `/review/candidates/${encodeURIComponent(id)}/series-unlink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateId })
  });
}

export async function getCandidate(token: string, id: string) {
  return adminFetch<EventCandidateDetailResponse>(token, `/review/candidates/${encodeURIComponent(id)}`);
}

export async function approveCandidate(token: string, id: string, body: ApproveBody) {
  return adminFetch<ReviewDecisionResponse>(token, `/review/candidates/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function rejectCandidate(token: string, id: string, body: RejectBody) {
  return adminFetch<ReviewDecisionResponse>(token, `/review/candidates/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function deleteCandidate(token: string, id: string, options: { force?: boolean } = {}) {
  const query = options.force ? "?force=true" : "";
  return adminFetch<CandidateBulkDeleteResponse>(
    token,
    `/review/candidates/${encodeURIComponent(id)}${query}`,
    { method: "DELETE" }
  );
}

export async function deleteCandidates(token: string, ids: string[], options: { force?: boolean } = {}) {
  const query = options.force ? "?force=true" : "";
  return adminFetch<CandidateBulkDeleteResponse>(token, `/review/candidates/bulk-delete${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids })
  });
}

export async function bulkApproveCandidates(token: string, ids: string[], body: Omit<BulkApproveBody, "ids"> = {}) {
  return adminFetch<CandidateBulkApproveResponse>(token, "/review/candidates/bulk-approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, ids })
  });
}

export async function bulkApproveAllPending(token: string, body: Omit<BulkApproveBody, "ids"> = {}) {
  return adminFetch<CandidateBulkApproveResponse>(token, "/review/candidates/bulk-approve-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "pending_review", ...body })
  });
}

export async function approveCandidateChanges(token: string, id: string, body: ApproveBody) {
  return adminFetch<ReviewDecisionResponse>(token, `/review/candidates/${encodeURIComponent(id)}/approve-changes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function bulkApproveChanges(token: string, ids: string[], body: Omit<BulkApproveBody, "ids"> = {}) {
  return adminFetch<CandidateBulkApproveChangesResponse>(token, "/review/candidates/bulk-approve-changes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, ids })
  });
}

export async function bulkApproveChangesAll(token: string, body: Omit<BulkApproveBody, "ids"> = {}) {
  return adminFetch<CandidateBulkApproveChangesResponse>(token, "/review/candidates/bulk-approve-changes-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function bulkSetCandidatePriority(token: string, ids: string[], priority: number) {
  return adminFetch<CandidateBulkPriorityResponse>(token, "/review/candidates/bulk-priority", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, priority })
  });
}

export async function bulkRejectCandidates(
  token: string,
  ids: string[],
  body: Omit<RejectBody, "notes"> & { notes?: string } = {}
) {
  return adminFetch<CandidateBulkRejectResponse>(token, "/review/candidates/bulk-reject", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, ids })
  });
}

export async function getHomepageSlots(token: string) {
  return adminFetch<HomepageSlotsResponse>(token, "/review/homepage-slots");
}

export async function saveHomepageSlots(token: string, body: HomepageSlotsPutBody) {
  return adminFetch<HomepageSlotsResponse>(token, "/review/homepage-slots", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export async function listPublishedEvents(
  token: string,
  opts?: {
    limit?: number;
    offset?: number;
    scope?: "future" | "past" | "all";
    q?: string;
  }
) {
  const params = new URLSearchParams();
  if (opts?.limit !== undefined) {
    params.set("limit", String(opts.limit));
  }
  if (opts?.offset !== undefined) {
    params.set("offset", String(opts.offset));
  }
  if (opts?.scope) {
    params.set("scope", opts.scope);
  }
  if (opts?.q?.trim()) {
    params.set("q", opts.q.trim());
  }
  const query = params.toString();
  return adminFetch<AdminEventListResponse>(token, `/review/events${query ? `?${query}` : ""}`);
}

export async function searchPublishedEvents(
  token: string,
  q: string,
  opts?: { limit?: number; scope?: "future" | "all" }
) {
  const params = new URLSearchParams({ q });
  if (opts?.limit) {
    params.set("limit", String(opts.limit));
  }
  if (opts?.scope) {
    params.set("scope", opts.scope);
  }
  return adminFetch<AdminEventSearchResponse>(token, `/review/events/search?${params}`);
}

export async function getPublishedEvent(token: string, eventId: string) {
  return adminFetch<AdminPublishedEventResponse>(token, `/review/events/${encodeURIComponent(eventId)}`);
}

export async function bulkSetPublishedEventPriority(token: string, ids: string[], priority: number) {
  return adminFetch<EventBulkPriorityResponse>(token, "/review/events/bulk-priority", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, priority })
  });
}

export async function patchPublishedEvent(token: string, eventId: string, body: AdminEventPatchBody) {
  return adminFetch<{ event: AdminPublishedEventResponse["event"] }>(
    token,
    `/review/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
}

async function adminFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new AdminApiError("VITE_API_URL is not set; cannot reach the review API.", 0);
  }

  const response = await fetch(new URL(path, apiUrl), {
    ...init,
    headers: {
      Accept: "application/json",
      "x-admin-token": token,
      ...init.headers
    }
  });

  let payload: ApiResponse<T>;
  try {
    payload = await response.json() as ApiResponse<T>;
  } catch {
    throw new AdminApiError(`Request failed with ${response.status} and no JSON body.`, response.status);
  }

  if (!payload.ok) {
    throw new AdminApiError(payload.error.message, response.status);
  }

  return payload.data;
}
