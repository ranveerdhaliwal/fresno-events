const EVENT_PRIORITY_MIN = 0;
const EVENT_PRIORITY_MAX = 5;
const EVENT_PRIORITY_DEFAULT = 5;

export interface EventDisplayPriorityTier {
  value: number;
  label: string;
  description: string;
}

/** Editorial display priority for published events and AI triage hints. Lower = more prominent. */
export const EVENT_DISPLAY_PRIORITY: readonly EventDisplayPriorityTier[] = [
  {
    value: 0,
    label: "Sponsored",
    description: "Reserved for ads / sponsored placements — not for organic public events"
  },
  {
    value: 1,
    label: "Biggest",
    description: "Biggest event of the period (city-wide draw)"
  },
  {
    value: 2,
    label: "Major",
    description: "Big events: major names, rare playoffs or special shows"
  },
  {
    value: 3,
    label: "Exciting",
    description: "Medium names, not that common, still exciting"
  },
  {
    value: 4,
    label: "Notable",
    description: "Bigger than usual local listing"
  },
  {
    value: 5,
    label: "Default",
    description: "Routine community listing"
  }
] as const;

export function getEventDisplayPriorityLabel(value: number): string {
  return EVENT_DISPLAY_PRIORITY.find((tier) => tier.value === value)?.label ?? `P${value}`;
}

export function clampEventPriority(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return EVENT_PRIORITY_DEFAULT;
  }
  return Math.min(EVENT_PRIORITY_MAX, Math.max(EVENT_PRIORITY_MIN, value));
}

/**
 * Organic ingest candidates should not get priority 0 (ads). Junk may still be rejected separately.
 */
export function clampSuggestedPriorityForOrganicEvent(value: unknown, isJunk: boolean): number {
  const clamped = clampEventPriority(value);
  if (isJunk) {
    return clamped;
  }
  if (clamped === 0) {
    return EVENT_PRIORITY_DEFAULT;
  }
  return clamped;
}

export function formatEventDisplayPriorityRubric(): string {
  return EVENT_DISPLAY_PRIORITY.map((tier) => `${tier.value}=${tier.label}: ${tier.description}`).join("; ");
}
