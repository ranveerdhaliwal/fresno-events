import type { EventSource, NormalizedEvent } from "@fresno-events/shared";

import { resolveGobulldogsPriority } from "@/scrapers/gobulldogs-priority.utils";

/** Predefined editorial priority for matching ingest candidates (overrides AI). */
export interface VenuePriorityRule {
  /** When set, candidate must match this ingest source. */
  source?: EventSource;
  /** Case-insensitive substring on venueName (optional extra filter). */
  venueNameIncludes?: string;
  priority: number;
  /** Short label for review notes / logs. */
  label: string;
}

/**
 * Venue/source defaults. First matching rule wins.
 * Add rows here when a venue or source should not rely on AI for display priority.
 */
const VENUE_PRIORITY_RULES: readonly VenuePriorityRule[] = [
  {
    source: "api:milb",
    priority: 3,
    label: "Grizzlies / MiLB"
  }
];

export function resolveVenueSuggestedPriority(event: NormalizedEvent): number | null {
  const gobulldogs = resolveGobulldogsPriority(event);
  if (gobulldogs) {
    return gobulldogs.priority;
  }
  const match = findVenuePriorityRule(event);
  return match?.priority ?? null;
}

export function findVenuePriorityRule(event: NormalizedEvent): VenuePriorityRule | null {
  for (const rule of VENUE_PRIORITY_RULES) {
    if (rule.source && event.source !== rule.source) {
      continue;
    }
    if (rule.venueNameIncludes) {
      const venue = event.venueName?.toLowerCase() ?? "";
      if (!venue.includes(rule.venueNameIncludes.toLowerCase())) {
        continue;
      }
    }
    return rule;
  }
  return null;
}

export function applyVenuePriorityOverride(
  event: NormalizedEvent,
  aiPriority: number,
  reviewNotes: string
): { suggested_priority: number; review_notes: string } {
  const gobulldogs = resolveGobulldogsPriority(event);
  if (gobulldogs) {
    const venueNote = `[venue] ${gobulldogs.label} → P${gobulldogs.priority}`;
    const notes = reviewNotes.includes("[venue]") ? reviewNotes : `${reviewNotes} · ${venueNote}`;
    return {
      suggested_priority: gobulldogs.priority,
      review_notes: notes
    };
  }

  const rule = findVenuePriorityRule(event);
  if (!rule) {
    return { suggested_priority: aiPriority, review_notes: reviewNotes };
  }

  const venueNote = `[venue] ${rule.label} → P${rule.priority}`;
  const notes = reviewNotes.includes("[venue]") ? reviewNotes : `${reviewNotes} · ${venueNote}`;

  return {
    suggested_priority: rule.priority,
    review_notes: notes
  };
}
