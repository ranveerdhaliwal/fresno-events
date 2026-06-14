const PACIFIC = "America/Los_Angeles";

export interface PacificDateTimeParts {
  date: string;
  time: string;
  hour: number;
  minute: number;
}

export function getPacificDateTimeParts(instant: Date): PacificDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hourRaw = Number(get("hour"));
  const minute = Number(get("minute"));
  const hour = hourRaw === 24 ? 0 : hourRaw;

  return {
    date: `${year}-${month}-${day}`,
    time: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    hour,
    minute
  };
}

/** Downtown-fresno and similar scrapers use noon UTC as an all-day sentinel. */
/** Visit Fresno `eventDate` uses `…T06:59:59.000Z`, which shows as 11:59 PM Pacific. */
export function isVisitFresnoEndOfDayUtc(iso: string): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getUTCHours() === 6 && d.getUTCMinutes() === 59;
}

export function isUtcNoonAllDaySentinel(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return false;
  }
  return d.getUTCHours() === 12 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
}

export function isAllDayPacificStart(iso: string): boolean {
  if (isUtcNoonAllDaySentinel(iso)) {
    return true;
  }
  if (isVisitFresnoEndOfDayUtc(iso)) {
    return true;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return false;
  }
  const { hour, minute } = getPacificDateTimeParts(d);
  return hour === 0 && minute === 0;
}

export function instantFromPacificLocal(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const trimmedTime = time.trim();
  const timePart = trimmedTime || "00:00";
  if (trimmedTime && !/^\d{1,2}:\d{2}$/.test(trimmedTime)) {
    return null;
  }

  const [hourRaw, minuteRaw] = timePart.split(":").map(Number);
  const hour = hourRaw ?? 0;
  const minute = minuteRaw ?? 0;
  if (hour > 23 || minute > 59) {
    return null;
  }

  const [yearRaw, monthRaw, dayRaw] = date.split("-").map(Number);
  const year = yearRaw ?? 0;
  const month = monthRaw ?? 1;
  const day = dayRaw ?? 1;
  const base = Date.UTC(year, month - 1, day, 8, 0, 0);

  for (let deltaMs = -14 * 3_600_000; deltaMs <= 14 * 3_600_000; deltaMs += 60_000) {
    const probe = new Date(base + deltaMs);
    const pacific = getPacificDateTimeParts(probe);
    if (pacific.date === date && pacific.hour === hour && pacific.minute === minute) {
      return probe.toISOString();
    }
  }

  return null;
}

export function pacificEndOfDayInstant(date: string): string | null {
  return instantFromPacificLocal(date, "23:59");
}

export function formatPacificDateTimeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  if (isAllDayPacificStart(iso)) {
    const { date } = getPacificDateTimeParts(d);
    return `All day · ${formatPacificDateLong(date)}`;
  }
  return d.toLocaleString("en-US", {
    timeZone: PACIFIC,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export function formatPacificDateLong(dateYmd: string): string {
  const probe = instantFromPacificLocal(dateYmd, "12:00");
  if (!probe) {
    return dateYmd;
  }
  return new Date(probe).toLocaleDateString("en-US", {
    timeZone: PACIFIC,
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

