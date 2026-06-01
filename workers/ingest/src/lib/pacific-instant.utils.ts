const PACIFIC = "America/Los_Angeles";

export function getPacificDateTimeParts(instant: Date): { date: string; hour: number; minute: number } {
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

  return {
    date: `${year}-${month}-${day}`,
    hour: Number(get("hour")),
    minute: Number(get("minute"))
  };
}

/** Visit Fresno `eventDate` often ends with T06:59:59.000Z — end of that Pacific calendar day (11:59 PM PT). */
export function isVisitFresnoEndOfDayUtc(iso: string): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getUTCHours() === 6 && d.getUTCMinutes() === 59;
}

/** Matches admin “empty start time = all-day” (`${date}T12:00:00Z`). */
export function isDateOnlyStartTs(iso: string): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getUTCHours() === 12 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
}

/** Pacific calendar date with no known wall time — not a real noon start. */
export function dateOnlyStartTs(dateYmd: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    return null;
  }
  return new Date(`${dateYmd}T12:00:00.000Z`).toISOString();
}

export function instantFromPacificLocal(dateYmd: string, timeHHmm: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    return null;
  }

  const [hourRaw, minuteRaw] = timeHHmm.split(":").map(Number);
  const hour = hourRaw ?? 0;
  const minute = minuteRaw ?? 0;
  if (hour > 23 || minute > 59) {
    return null;
  }

  const [year, month, day] = dateYmd.split("-").map(Number);
  const base = Date.UTC(year!, month! - 1, day!, 8, 0, 0);

  // Pacific wall times on dateYmd can be up to ~24h from this UTC anchor (evening events).
  for (let deltaMs = -26 * 3_600_000; deltaMs <= 26 * 3_600_000; deltaMs += 60_000) {
    const probe = new Date(base + deltaMs);
    const pacific = getPacificDateTimeParts(probe);
    if (pacific.date === dateYmd && pacific.hour === hour && pacific.minute === minute) {
      return probe.toISOString();
    }
  }

  return null;
}
