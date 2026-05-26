import type {
  ApiResponse,
  EventCandidate,
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

export type CandidateStatusFilter = EventCandidate["status"];

export async function listCandidates(token: string, status: CandidateStatusFilter) {
  return adminFetch<EventCandidateListResponse>(token, `/review/candidates?status=${encodeURIComponent(status)}&limit=100`);
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
