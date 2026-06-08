import type { EventCandidate } from "@fresno-events/shared";

/** Filter candidates already scoped to the active review tab (e.g. pending_review on New). */
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
