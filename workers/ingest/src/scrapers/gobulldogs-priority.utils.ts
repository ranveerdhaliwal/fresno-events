import type { NormalizedEvent } from "@fresno-events/shared";

export const BULLDOGS_BASE_PRIORITY = 4;
export const BULLDOGS_FOOTBALL_PRIORITY = 3;
export const BULLDOGS_FINAL_PRIORITY_BUMP = 1;

const FINAL_PATTERN =
  /\b(final|championship|title game|semifinal|quarterfinal|conference tournament)\b/i;

export function isGobulldogsFootball(event: NormalizedEvent): boolean {
  if (event.tags?.includes("sport:football")) {
    return true;
  }
  return /^football\b/i.test(event.title.trim());
}

export function isGobulldogsFinalEvent(event: NormalizedEvent): boolean {
  if (event.tags?.includes("final")) {
    return true;
  }
  const blob = `${event.title} ${event.descriptionText ?? ""} ${event.description ?? ""}`;
  return FINAL_PATTERN.test(blob);
}

export function resolveGobulldogsPriority(
  event: NormalizedEvent
): { priority: number; label: string } | null {
  if (event.source !== "api:gobulldogs") {
    return null;
  }

  const football = isGobulldogsFootball(event);
  let priority = football ? BULLDOGS_FOOTBALL_PRIORITY : BULLDOGS_BASE_PRIORITY;
  let label = football ? "Bulldogs football" : "Bulldogs";

  if (isGobulldogsFinalEvent(event)) {
    priority = Math.max(0, priority - BULLDOGS_FINAL_PRIORITY_BUMP);
    label = `${label} final/championship`;
  }

  return { priority, label };
}
