import type { CandidateBulkDeleteResponse, CandidateDeleteSkipReason } from "@fresno-events/shared";

export function partitionCandidatesForDelete(
  ids: string[],
  rows: Array<{ id: string; status: string }>,
  force: boolean
): { toDelete: string[]; skipped: CandidateBulkDeleteResponse["skipped"] } {
  const uniqueIds = [...new Set(ids)];
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const toDelete: string[] = [];
  const skipped: CandidateBulkDeleteResponse["skipped"] = [];

  for (const id of uniqueIds) {
    const row = rowById.get(id);
    if (!row) {
      skipped.push({ id, reason: "not_found" });
      continue;
    }
    if (row.status === "approved" && !force) {
      skipped.push({ id, reason: "approved" satisfies CandidateDeleteSkipReason });
      continue;
    }
    toDelete.push(id);
  }

  return { toDelete, skipped };
}
