import {
  addDaysToIsoDate,
  pacificMonthBounds,
  pacificTodayIso,
  selectEventPreview,
  type CalendarDayBucket,
  type CalendarMonthResponse,
  type CalendarWeekBucket,
  type EventListItem
} from "@fresno-events/shared";

import type { Env } from "@/env";
import { groupEventsByIsoDate } from "@/lib/event-sections";
import { listEventsFromSupabase } from "@/lib/supabase-events";

function formatWeekLabel(fromIso: string, untilIso: string): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/Los_Angeles"
    }).format(new Date(`${iso}T12:00:00-07:00`));
  return `${fmt(fromIso).toUpperCase()} – ${fmt(untilIso).toUpperCase()}`;
}

function calendarGridDays(year: number, month: number): string[] {
  const first = pacificMonthBounds(year, month);
  const [startYear, startMonth, startDay] = first.fromIso.split("-").map(Number);
  const firstDow = new Date(Date.UTC(startYear!, startMonth! - 1, startDay!)).getUTCDay();
  const gridStart = addDaysToIsoDate(first.fromIso, -firstDow);

  const days: string[] = [];
  let cursor = gridStart;
  for (let i = 0; i < 42; i += 1) {
    days.push(cursor);
    cursor = addDaysToIsoDate(cursor, 1);
  }
  return days;
}

function weekBucketsForMonth(year: number, month: number, byDate: Map<string, EventListItem[]>): CalendarWeekBucket[] {
  const monthStart = pacificMonthBounds(year, month).fromIso;
  const monthEnd = pacificMonthBounds(year, month).untilIso;
  const weeks: CalendarWeekBucket[] = [];

  let cursor = monthStart;
  while (cursor <= monthEnd) {
    const [y, m, d] = cursor.split("-").map(Number);
    const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
    const weekStart = addDaysToIsoDate(cursor, -dow);
    const weekEnd = addDaysToIsoDate(weekStart, 6);

    const items: EventListItem[] = [];
    let dayCursor = weekStart;
    while (dayCursor <= weekEnd) {
      const dayItems = byDate.get(dayCursor) ?? [];
      items.push(...dayItems);
      dayCursor = addDaysToIsoDate(dayCursor, 1);
    }

    const { preview, total, hidden } = selectEventPreview(items);
    weeks.push({
      label: formatWeekLabel(weekStart, weekEnd),
      fromIso: weekStart,
      untilIso: weekEnd,
      total,
      preview,
      hidden
    });

    cursor = addDaysToIsoDate(weekEnd, 1);
  }

  return weeks;
}

export async function resolveCalendarMonth(
  env: Env,
  year: number,
  month: number,
  now = new Date()
): Promise<CalendarMonthResponse> {
  const bounds = pacificMonthBounds(year, month);
  const from = bounds.from.getTime() < now.getTime() ? now : bounds.from;
  const result = await listEventsFromSupabase(env, {
    from,
    until: bounds.until,
    limit: 200
  });

  const byDate = groupEventsByIsoDate(result.items);
  const gridDays = calendarGridDays(year, month);

  const days: CalendarDayBucket[] = gridDays.map((isoDate) => {
    const dayItems = byDate.get(isoDate) ?? [];
    const { preview, total, hidden } = selectEventPreview(dayItems, { maxP3: 2, maxP4: 1, maxP5: 1 });
    return { isoDate, total, preview, hidden };
  });

  const weeks = weekBucketsForMonth(year, month, byDate);

  return {
    year,
    month,
    days,
    weeks,
    generatedAt: new Date().toISOString()
  };
}

export function parseCalendarMonthQuery(
  yearRaw: string | undefined,
  monthRaw: string | undefined,
  now = new Date()
): { year: number; month: number } | null {
  const todayIso = pacificTodayIso(now);
  const [defaultYear, defaultMonth] = todayIso.split("-").map(Number);
  const year = yearRaw ? Number(yearRaw) : defaultYear!;
  const month = monthRaw ? Number(monthRaw) : defaultMonth!;

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
}
