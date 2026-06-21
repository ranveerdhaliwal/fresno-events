import {
  clampSuggestedPriorityForOrganicEvent,
  EVENT_PRIORITY_DEFAULT,
  EVENT_PRIORITY_MAX,
  EVENT_PRIORITY_MIN,
  type CandidateApproveSkipReason,
  type CandidateBulkApproveResponse,
  type EventCandidate
} from "@fresno-events/shared";

export const BULK_APPROVE_MAX_IDS = 100;
export const BULK_APPROVE_CHUNK_SIZE = 100;

export function parseBulkApproveIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const ids = value.filter((id): id is string => typeof id === "string" && id.length > 0);
  return ids.length > 0 ? [...new Set(ids)] : null;
}

export function validateBulkApproveIdCount(ids: string[]): string | null {
  if (ids.length > BULK_APPROVE_MAX_IDS) {
    return `At most ${BULK_APPROVE_MAX_IDS} ids per bulk-approve request.`;
  }

  return null;
}

export function resolveBulkApprovePriority(
  candidate: Pick<EventCandidate, "suggestedPriority">,
  explicit?: number
): number {
  if (explicit !== undefined) {
    return clampOrganicApprovePriority(explicit);
  }

  const suggested = candidate.suggestedPriority;
  if (suggested !== undefined && Number.isInteger(suggested)) {
    return clampOrganicApprovePriority(suggested);
  }

  return EVENT_PRIORITY_DEFAULT;
}

export function parseBulkApprovePriorityById(value: unknown): Record<string, number> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const out: Record<string, number> = {};
  for (const [id, rawPriority] of Object.entries(value)) {
    if (typeof id !== "string" || id.length === 0 || typeof rawPriority !== "number") {
      continue;
    }
    out[id] = resolveBulkApprovePriority({}, rawPriority);
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export function resolveBulkApprovePriorityForCandidate(
  candidate: Pick<EventCandidate, "id" | "suggestedPriority">,
  options: { explicit?: number; priorityById?: Record<string, number> }
): number {
  const perId = options.priorityById?.[candidate.id];
  if (perId !== undefined) {
    return resolveBulkApprovePriority(candidate, perId);
  }

  if (options.explicit !== undefined) {
    return resolveBulkApprovePriority(candidate, options.explicit);
  }

  return resolveBulkApprovePriority(candidate);
}

/** Ingest candidates are organic; P0 is for manually published sponsored events only. */
function clampOrganicApprovePriority(value: number): number {
  if (!Number.isInteger(value) || value < EVENT_PRIORITY_MIN || value > EVENT_PRIORITY_MAX) {
    return EVENT_PRIORITY_DEFAULT;
  }

  return clampSuggestedPriorityForOrganicEvent(value, false);
}

export function partitionCandidatesForApprove(
  ids: string[],
  rows: Array<{ id: string; status: string }>
): {
  toApprove: string[];
  skipped: CandidateBulkApproveResponse["skipped"];
} {
  const uniqueIds = [...new Set(ids)];
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const toApprove: string[] = [];
  const skipped: CandidateBulkApproveResponse["skipped"] = [];

  for (const id of uniqueIds) {
    const row = rowById.get(id);
    if (!row) {
      skipped.push({ id, reason: "not_found" });
      continue;
    }
    if (row.status === "approved") {
      skipped.push({ id, reason: "already_approved" });
      continue;
    }
    if (row.status !== "pending_review") {
      skipped.push({ id, reason: "not_pending" });
      continue;
    }
    toApprove.push(id);
  }

  return { toApprove, skipped };
}

export function mergeBulkApproveResults(
  parts: CandidateBulkApproveResponse[]
): CandidateBulkApproveResponse {
  return parts.reduce(
    (acc, part) => ({
      approved: acc.approved + part.approved,
      skipped: [...acc.skipped, ...part.skipped],
      failed: [...acc.failed, ...part.failed]
    }),
    { approved: 0, skipped: [], failed: [] } satisfies CandidateBulkApproveResponse
  );
}

export function chunkIds(ids: string[], size: number = BULK_APPROVE_CHUNK_SIZE): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

export function parseBulkApproveAllLimit(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return undefined;
  }

  return Math.min(value, 5000);
}
