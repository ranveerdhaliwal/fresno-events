import type { NormalizedEvent } from "@fresno-events/shared";
import { suggestEventPriority } from "@fresno-events/shared";

import { resolveGobulldogsPriority } from "@/scrapers/gobulldogs-priority.utils";

function toRuleInput(event: NormalizedEvent) {
  return {
    source: event.source,
    title: event.title,
    venueName: event.venueName ?? ""
  };
}

/**
 * Deterministic editorial priority for an ingest candidate (overrides AI when matched).
 * Bulldogs games use their own dynamic logic; everything else uses the shared rule engine
 * (venue/source defaults + recurring-listing demotions + named editorial draws).
 */
export function resolveVenueSuggestedPriority(event: NormalizedEvent): number | null {
  const gobulldogs = resolveGobulldogsPriority(event);
  if (gobulldogs) {
    return gobulldogs.priority;
  }
  return suggestEventPriority(toRuleInput(event))?.priority ?? null;
}

export function applyVenuePriorityOverride(
  event: NormalizedEvent,
  aiPriority: number,
  reviewNotes: string
): { suggested_priority: number; review_notes: string } {
  const gobulldogs = resolveGobulldogsPriority(event);
  if (gobulldogs) {
    return withVenueNote(gobulldogs.priority, gobulldogs.label, reviewNotes);
  }

  const suggestion = suggestEventPriority(toRuleInput(event));
  if (!suggestion) {
    return { suggested_priority: aiPriority, review_notes: reviewNotes };
  }

  return withVenueNote(suggestion.priority, suggestion.ruleLabel, reviewNotes);
}

function withVenueNote(
  priority: number,
  label: string,
  reviewNotes: string
): { suggested_priority: number; review_notes: string } {
  const venueNote = `[venue] ${label} → P${priority}`;
  const notes = reviewNotes.includes("[venue]") ? reviewNotes : `${reviewNotes} · ${venueNote}`;
  return { suggested_priority: priority, review_notes: notes };
}
