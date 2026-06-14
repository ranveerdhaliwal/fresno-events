import { pacificTodayIso } from "@fresno-events/shared";

import type { DayStripTile } from "@/lib/event-view-model.types";
import { isWeekend } from "@/lib/event-time";
import { addDaysIso } from "@/lib/parse-day-param";

/** ISO date for the first tile when `selectedIso` is centered in the row. */
export function dayWindowStart(selectedIso: string, slotCount: number): string {
  const before = Math.floor((slotCount - 1) / 2);
  return addDaysIso(selectedIso, -before);
}

/** Signed day distance from `fromIso` to `toIso`. */
export function daysBetweenIso(fromIso: string, toIso: string): number {
  const from = new Date(`${fromIso}T12:00:00-07:00`).getTime();
  const to = new Date(`${toIso}T12:00:00-07:00`).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function buildDayWindowTiles(
  startIso: string,
  slotCount: number,
  eventCounts: Map<string, number>,
  todayIso = pacificTodayIso()
): DayStripTile[] {
  const tiles: DayStripTile[] = [];

  for (let i = 0; i < slotCount; i += 1) {
    const iso = addDaysIso(startIso, i);
    const date = new Date(`${iso}T12:00:00-07:00`);
    tiles.push({
      isoDate: iso,
      dow: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Los_Angeles" })
        .format(date)
        .toUpperCase(),
      dayNum: new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "America/Los_Angeles" }).format(date),
      count: eventCounts.get(iso) ?? 0,
      isToday: iso === todayIso,
      isWeekend: isWeekend(date)
    });
  }

  return tiles;
}
