import {
  resolvePacificDateWindow,
  selectEventPreview,
  type EventListItem,
  type EventSectionBucket,
  type EventSectionsResponse
} from "@fresno-events/shared";

import type { Env } from "@/env";
import { listEventsFromSupabase } from "@/lib/supabase-events";

async function loadSection(
  env: Env,
  preset: "today" | "thisWeek" | "thisWeekend",
  now: Date
): Promise<EventSectionBucket> {
  const window = resolvePacificDateWindow(preset, now);
  const result = await listEventsFromSupabase(env, {
    from: window.from,
    until: window.until,
    limit: 100
  });
  const { preview, total, hidden } = selectEventPreview(result.items);
  return {
    preview,
    total,
    hidden,
    fromIso: window.fromIso,
    untilIso: window.untilIso
  };
}

export async function resolveEventSections(env: Env, now = new Date()): Promise<EventSectionsResponse> {
  const [today, week, weekend] = await Promise.all([
    loadSection(env, "today", now),
    loadSection(env, "thisWeek", now),
    loadSection(env, "thisWeekend", now)
  ]);

  return {
    today,
    week,
    weekend,
    generatedAt: now.toISOString()
  };
}

export function groupEventsByIsoDate(items: EventListItem[]): Map<string, EventListItem[]> {
  const map = new Map<string, EventListItem[]>();
  for (const item of items) {
    const iso = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(item.event.startTs));
    const bucket = map.get(iso) ?? [];
    bucket.push(item);
    map.set(iso, bucket);
  }
  return map;
}
