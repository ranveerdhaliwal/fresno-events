import type { NormalizedEvent } from "@fresno-events/shared";
import { pacificTodayIso } from "@fresno-events/shared";

import { getPacificDateTimeParts } from "@/lib/pacific-instant.utils";

/** True when the event's Pacific calendar date is before today. */
export function isPastPacificEvent(startTs: string, now: Date): boolean {
  const start = new Date(startTs);
  if (Number.isNaN(start.getTime())) {
    return true;
  }

  return getPacificDateTimeParts(start).date < pacificTodayIso(now);
}

/** Drop ingest rows whose Pacific start date is already in the past. */
export function filterUpcomingIngestEvents(events: NormalizedEvent[], now: Date): NormalizedEvent[] {
  return events.filter((event) => !isPastPacificEvent(event.startTs, now));
}
