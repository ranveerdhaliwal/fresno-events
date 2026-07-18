import type { CandidateApproveChangesSkipReason, CandidateBulkApproveChangesResponse } from "@fresno-events/shared";

export const BULK_APPROVE_CHANGES_MAX_IDS = 100;
export const BULK_APPROVE_CHANGES_CHUNK_SIZE = 100;

export function parseBulkApproveChangesIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const ids = value.filter((id): id is string => typeof id === "string" && id.length > 0);
  return ids.length > 0 ? [...new Set(ids)] : null;
}

export function validateBulkApproveChangesIdCount(ids: string[]): string | null {
  if (ids.length > BULK_APPROVE_CHANGES_MAX_IDS) {
    return `At most ${BULK_APPROVE_CHANGES_MAX_IDS} ids per bulk-approve-changes request.`;
  }

  return null;
}

export function partitionCandidatesForApproveChanges(
  ids: string[],
  rows: Array<{ id: string; status: string; matched_event_id?: string | null }>
): {
  toApprove: string[];
  skipped: CandidateBulkApproveChangesResponse["skipped"];
} {
  const uniqueIds = [...new Set(ids)];
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const toApprove: string[] = [];
  const skipped: CandidateBulkApproveChangesResponse["skipped"] = [];

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
    if (row.status !== "needs_changes") {
      skipped.push({ id, reason: "not_needs_changes" });
      continue;
    }
    if (!row.matched_event_id) {
      skipped.push({ id, reason: "missing_matched_event" });
      continue;
    }
    toApprove.push(id);
  }

  return { toApprove, skipped };
}

export function mergeBulkApproveChangesResults(
  parts: CandidateBulkApproveChangesResponse[]
): CandidateBulkApproveChangesResponse {
  return parts.reduce(
    (acc, part) => ({
      approved: acc.approved + part.approved,
      skipped: [...acc.skipped, ...part.skipped],
      failed: [...acc.failed, ...part.failed]
    }),
    { approved: 0, skipped: [], failed: [] } satisfies CandidateBulkApproveChangesResponse
  );
}

export function chunkApproveChangesIds(
  ids: string[],
  size: number = BULK_APPROVE_CHANGES_CHUNK_SIZE
): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

export type { CandidateApproveChangesSkipReason };
