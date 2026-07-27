export const PACIFIC_TZ = "America/Los_Angeles";

export type DateWindowPreset = "today" | "thisWeek" | "thisWeekend" | "thisMonth";

export interface PacificDateRange {
  fromIso: string;
  untilIso: string;
  from: Date;
  until: Date;
}

function pacificDateParts(instant: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

export function pacificTodayIso(now = new Date()): string {
  const { year, month, day } = pacificDateParts(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, day! + days));
  return next.toISOString().slice(0, 10);
}

function pacificOffsetHoursAtNoonUtc(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  const probe = new Date(Date.UTC(year!, month! - 1, day!, 12, 0, 0));
  const pacificHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: PACIFIC_TZ, hour: "numeric", hour12: false }).format(probe)
  );
  return 12 - pacificHour;
}

export function pacificStartOfDay(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  const offsetHours = pacificOffsetHoursAtNoonUtc(isoDate);
  return new Date(Date.UTC(year!, month! - 1, day!, 0, 0, 0) - offsetHours * 60 * 60 * 1000);
}

export function pacificEndOfDay(isoDate: string): Date {
  const nextDay = addDaysToIsoDate(isoDate, 1);
  return new Date(pacificStartOfDay(nextDay).getTime() - 1);
}

export function upcomingSundayIso(fromIso: string): string {
  const [year, month, day] = fromIso.split("-").map(Number);
  const dow = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  const daysUntilSunday = dow === 0 ? 0 : 7 - dow;
  return addDaysToIsoDate(fromIso, daysUntilSunday);
}

export function daysFromIsoThroughSunday(fromIso: string): string[] {
  const endIso = upcomingSundayIso(fromIso);
  const days: string[] = [];
  let cursor = fromIso;
  while (cursor <= endIso) {
    days.push(cursor);
    cursor = addDaysToIsoDate(cursor, 1);
  }
  return days;
}

export function nextSaturdayIso(fromIso: string): string {
  const [year, month, day] = fromIso.split("-").map(Number);
  const dow = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  const daysUntilSaturday = (6 - dow + 7) % 7;
  return addDaysToIsoDate(fromIso, daysUntilSaturday);
}

export function pacificMonthBounds(year: number, month: number): PacificDateRange {
  const fromIso = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const untilIso = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return {
    fromIso,
    untilIso,
    from: pacificStartOfDay(fromIso),
    until: pacificEndOfDay(untilIso)
  };
}

export interface PacificMonthTile {
  year: number;
  month: number;
  shortLabel: string;
  yearLabel: string;
}

/** Next N calendar months starting from the Pacific month containing `now`. */
export function buildNextPacificMonths(count: number, now = new Date()): PacificMonthTile[] {
  const todayIso = pacificTodayIso(now);
  const [startYear, startMonth] = todayIso.split("-").map(Number);
  const tiles: PacificMonthTile[] = [];
  let year = startYear!;
  let month = startMonth!;

  for (let i = 0; i < count; i += 1) {
    const probe = new Date(`${year}-${String(month).padStart(2, "0")}-01T12:00:00-07:00`);
    const shortLabel = new Intl.DateTimeFormat("en-US", {
      month: "short",
      timeZone: PACIFIC_TZ
    })
      .format(probe)
      .toUpperCase();
    const yearLabel = String(year);
    tiles.push({ year, month, shortLabel, yearLabel });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return tiles;
}

export function isoDateInPacificMonth(isoDate: string, year: number, month: number): boolean {
  const [y, m] = isoDate.split("-").map(Number);
  return y === year && m === month;
}

export function resolvePacificDateWindow(preset: DateWindowPreset, now = new Date()): PacificDateRange {
  const todayIso = pacificTodayIso(now);

  switch (preset) {
    case "today":
      return {
        fromIso: todayIso,
        untilIso: todayIso,
        from: pacificStartOfDay(todayIso),
        until: pacificEndOfDay(todayIso)
      };
    case "thisWeek": {
      const untilIso = addDaysToIsoDate(todayIso, 6);
      return {
        fromIso: todayIso,
        untilIso,
        from: pacificStartOfDay(todayIso),
        until: pacificEndOfDay(untilIso)
      };
    }
    case "thisWeekend": {
      const saturdayIso = nextSaturdayIso(todayIso);
      const sundayIso = addDaysToIsoDate(saturdayIso, 1);
      return {
        fromIso: saturdayIso,
        untilIso: sundayIso,
        from: pacificStartOfDay(saturdayIso),
        until: pacificEndOfDay(sundayIso)
      };
    }
    case "thisMonth": {
      const { year, month } = pacificDateParts(now);
      const bounds = pacificMonthBounds(year, month);
      return {
        ...bounds,
        from: now
      };
    }
  }
}
