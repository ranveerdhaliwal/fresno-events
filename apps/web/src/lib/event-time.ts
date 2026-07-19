import { isAllDayPacificStart } from "@/lib/pacific-time";

const TIME_ZONE = "America/Los_Angeles";

export type DayPeriod = "live" | "morning" | "afternoon" | "evening";

export function formatShortTime(value: string | Date): string {
  const iso = typeof value === "string" ? value : value.toISOString();
  if (isAllDayPacificStart(iso)) {
    return "All day";
  }

  const formatted = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE
  }).format(new Date(iso));
  return formatted.replace(":00", "");
}

export function formatEventDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: TIME_ZONE
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatMonthLong(value: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: TIME_ZONE
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function formatMonthDay(value: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: TIME_ZONE
  }).format(typeof value === "string" ? new Date(value) : value);
}

export function toIsoDateLocal(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIME_ZONE
  }).formatToParts(value);
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export type EventTimeStatus = "past" | "live" | "upcoming";

export function resolveEventEnd(startTs: string, endTs?: string | null): Date {
  if (endTs) {
    return new Date(endTs);
  }
  return new Date(new Date(startTs).getTime() + 2 * 60 * 60 * 1000);
}

export function isLiveNow(startTs: string, endTs: string | undefined, now = new Date()): boolean {
  const start = new Date(startTs);
  const end = resolveEventEnd(startTs, endTs);
  return start <= now && now < end;
}

export function deriveEventTimeStatus(
  startTs: string,
  endTs: string | undefined,
  now = new Date()
): EventTimeStatus {
  if (isLiveNow(startTs, endTs, now)) {
    return "live";
  }
  if (resolveEventEnd(startTs, endTs) <= now) {
    return "past";
  }
  return "upcoming";
}

export function bucketPeriod(startTs: string, endTs: string | undefined, now = new Date()): DayPeriod {
  if (isLiveNow(startTs, endTs, now)) {
    return "live";
  }
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: TIME_ZONE }).format(new Date(startTs))
  );
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function daysUntil(startTs: string, now = new Date()): number {
  const start = new Date(startTs);
  const diff = start.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

export function formatCountdownLabel(startTs: string, now = new Date()): string {
  const days = daysUntil(startTs, now);
  if (days === 0) return "today";
  if (days === 1) return "in 1 day";
  return `in ${days} days`;
}

export function isTonight(startTs: string, now = new Date()): boolean {
  const eventIso = toIsoDateLocal(new Date(startTs));
  const todayIso = toIsoDateLocal(now);
  if (eventIso !== todayIso) {
    return false;
  }
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: TIME_ZONE }).format(
      new Date(startTs)
    )
  );
  return hour >= 17;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
