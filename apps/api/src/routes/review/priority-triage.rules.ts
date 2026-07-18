import { suggestEventPriority } from "@fresno-events/shared";

export interface TriageCandidateRow {
  id: string;
  title: string;
  venue_name: string;
  source: string;
  suggested_priority: number | null;
  status: string;
}

export interface TriageSuggestion {
  priority: number;
  ruleId: string;
  ruleLabel: string;
}

/**
 * Deterministic priority suggestion for a pending candidate. Delegates to the shared
 * rule engine (venue/source defaults + recurring demotions + named editorial draws) so
 * ingest enrichment and admin triage stay in lockstep.
 */
export function suggestEditorialPriority(row: TriageCandidateRow): TriageSuggestion | null {
  const suggestion = suggestEventPriority({
    source: row.source,
    title: row.title,
    venueName: row.venue_name
  });
  if (!suggestion) {
    return null;
  }
  return { priority: suggestion.priority, ruleId: suggestion.ruleId, ruleLabel: suggestion.ruleLabel };
}

export function currentSuggestedPriority(row: TriageCandidateRow): number {
  if (typeof row.suggested_priority === "number" && Number.isInteger(row.suggested_priority)) {
    return row.suggested_priority;
  }
  return 5;
}
