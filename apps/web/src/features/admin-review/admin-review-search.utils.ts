import type { EventCandidate } from "@fresno-events/shared";

import type { CandidateStatusFilter } from "../admin/admin-api.types";

export const ADMIN_SEARCH_STATUSES: CandidateStatusFilter[] = [
  "pending_review",
  "needs_changes",
  "approved",
  "rejected",
  "duplicate",
  "awaiting_enrichment"
];

export function filterCandidatesForSearch(items: EventCandidate[], query: string): EventCandidate[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) {
    return [];
  }

  return items
    .filter((row) => {
      const haystack =
        `${row.title} ${row.venueName} ${row.source} ${row.normalizedEvent.externalUrl ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    })
    .sort((left, right) => left.startTs.localeCompare(right.startTs));
}
