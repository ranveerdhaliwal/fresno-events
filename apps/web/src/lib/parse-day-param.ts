import { toIsoDateLocal } from "@/lib/event-time";

/** Normalizes /day/2026-05-22 or short /day/22 to ISO date in Pacific. */
export function parseDayParam(date: string, anchor = new Date()): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  if (/^\d{1,2}$/.test(date)) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      timeZone: "America/Los_Angeles"
    }).formatToParts(anchor);
    const year = parts.find((p) => p.type === "year")?.value ?? "2026";
    const month = parts.find((p) => p.type === "month")?.value ?? "01";
    const day = date.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return toIsoDateLocal(anchor);
}

export function dayBoundsPacific(isoDate: string): { from: Date; until: Date } {
  const from = new Date(`${isoDate}T00:00:00-07:00`);
  const until = new Date(`${isoDate}T23:59:59.999-07:00`);
  return { from, until };
}

export function addDaysIso(isoDate: string, delta: number): string {
  const date = new Date(`${isoDate}T12:00:00-07:00`);
  date.setDate(date.getDate() + delta);
  return toIsoDateLocal(date);
}
