import { pacificDateFromStartTs, type NormalizedEvent } from "@fresno-events/shared";
import { instantFromPacificLocal } from "@/lib/pacific-instant.utils";

/** The ticket-page header sometimes gives doors, while its details give showtime. */
export function resolveTowerShowTime(event: NormalizedEvent): NormalizedEvent {
  const description = event.descriptionText ?? "";
  const doors = /\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s+DOORS\b/i.exec(description);
  const show = /\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s+SHOW(?:TIME)?\b/i.exec(description);
  const date = pacificDateFromStartTs(event.startTs);
  if (!doors || !show || !date) return event;
  const clock = (match: RegExpExecArray): string | null => {
    const hour = Number(match[1]);
    const minute = Number(match[2] ?? 0);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    const h24 = hour % 12 + (match[3]?.toUpperCase() === "PM" ? 12 : 0);
    return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };
  const doorsClock = clock(doors);
  const showClock = clock(show);
  if (!doorsClock || !showClock || showClock < doorsClock) return event;
  const startTs = instantFromPacificLocal(date, showClock);
  const doorsTs = instantFromPacificLocal(date, doorsClock);
  return startTs && doorsTs ? { ...event, startTs, doorsTs } : event;
}
