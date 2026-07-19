import { normalizeTitle, type EventListItem } from "@fresno-events/shared";

import { resolveMediaUrl } from "@/lib/media-url";

/** Day-of-week label (SUN … SAT) for a Pacific ISO date. */
export function pacificDowShort(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dow = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][dow] ?? "";
}

export function isPacificWeekend(isoDate: string): boolean {
  const [year, month, day] = isoDate.split("-").map(Number);
  const dow = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  return dow === 0 || dow === 6;
}

export interface CalendarCollapsedPreview {
  /** Stable key from normalizeTitle (same show, different times → one row). */
  key: string;
  id: string;
  title: string;
  occurrenceCount: number;
  thumbUrl: string | null;
}

/**
 * Collapse same-name occurrences in a calendar day preview into one row.
 * Calendar tiles only — full list/detail still shows each occurrence.
 */
export function collapseCalendarPreview(items: EventListItem[]): CalendarCollapsedPreview[] {
  const order: string[] = [];
  const byKey = new Map<string, CalendarCollapsedPreview>();

  for (const item of items) {
    const key = normalizeTitle(item.event.title) || item.event.id;
    const existing = byKey.get(key);
    const thumbUrl = resolveMediaUrl(item.heroImage?.cdnUrl);

    if (existing) {
      existing.occurrenceCount += 1;
      if (!existing.thumbUrl && thumbUrl) {
        existing.thumbUrl = thumbUrl;
      }
      continue;
    }

    order.push(key);
    byKey.set(key, {
      key,
      id: item.event.id,
      title: item.event.title,
      occurrenceCount: 1,
      thumbUrl
    });
  }

  return order.map((key) => byKey.get(key)!);
}
