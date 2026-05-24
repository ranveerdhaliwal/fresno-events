import {
  clampEventPriority,
  clampSuggestedPriorityForOrganicEvent,
  EVENT_PRIORITY_DEFAULT
} from "@fresno-events/shared";

export function clampSuggestedPriority(value: unknown, isJunk: boolean): number {
  return clampSuggestedPriorityForOrganicEvent(value, isJunk);
}

export function clampEnrichmentConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, value));
}

export { clampEventPriority, EVENT_PRIORITY_DEFAULT };
