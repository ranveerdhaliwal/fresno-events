import type {
  ApiResponse,
  EventCandidate,
  CandidateBulkApproveChangesResponse,
  CandidateBulkApproveResponse,
  CandidateBulkDeleteResponse,
  EventCandidateDetailResponse,
  EventCandidateListResponse,
  NormalizedEvent,
  ReviewDecisionResponse
} from "@fresno-events/shared";

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

export type CandidateStatusFilter = EventCandidate["status"];

export type ReviewQueueTab = "new" | "updates" | "approved" | "rejected";

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

export async function listCandidates(
  token: string,
  status: CandidateStatusFilter,
  opts?: { limit?: number; offset?: number }
) {
  const params = new URLSearchParams({ status, limit: String(opts?.limit ?? 100) });
  if (opts?.offset) {
    params.set("offset", String(opts.offset));
  }
  return adminFetch<EventCandidateListResponse>(token, `/review/candidates?${params}`);
}

export async function getCandidate(token: string, id: string) {
  return adminFetch<EventCandidateDetailResponse>(token, `/review/candidates/${encodeURIComponent(id)}`);
}

export interface ApproveBody {
  event?: Partial<NormalizedEvent>;
  notes?: string;
  reviewedBy?: string;
  priority?: number;
}

export interface RejectBody {
  notes?: string;
  reviewedBy?: string;
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

export interface BulkApproveBody {
  ids?: string[];
  notes?: string;
  reviewedBy?: string;
  priority?: number;
  status?: "pending_review";
  limit?: number;
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
