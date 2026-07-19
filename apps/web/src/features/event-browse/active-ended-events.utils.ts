import type { EventListItem } from "@fresno-events/shared";

import { deriveEventTimeStatus, toIsoDateLocal } from "@/lib/event-time";

/** How many ended (past) events to show before "Show more ended". */
export const ENDED_EVENTS_PREVIEW = 3;

export function isPacificIsoDate(item: EventListItem, isoDate: string): boolean {
  return toIsoDateLocal(new Date(item.event.startTs)) === isoDate;
}

export function filterItemsOnPacificDate(items: EventListItem[], isoDate: string): EventListItem[] {
  return items.filter((item) => isPacificIsoDate(item, isoDate));
}

/** Drop events whose Pacific calendar day is before today. */
export function filterOutBeforePacificToday(items: EventListItem[], now = new Date()): EventListItem[] {
  const todayIso = toIsoDateLocal(now);
  return items.filter((item) => toIsoDateLocal(new Date(item.event.startTs)) >= todayIso);
}

export function filterOutPastItems(items: EventListItem[], now = new Date()): EventListItem[] {
  return items.filter((item) => deriveEventTimeStatus(item.event.startTs, item.event.endTs, now) !== "past");
}

export function compareByPriorityThenStart(a: EventListItem, b: EventListItem): number {
  if (a.event.priority !== b.event.priority) {
    return a.event.priority - b.event.priority;
  }
  return new Date(a.event.startTs).getTime() - new Date(b.event.startTs).getTime();
}

export function splitTodayItems(
  items: EventListItem[],
  now = new Date()
): { active: EventListItem[]; ended: EventListItem[] } {
  const active: EventListItem[] = [];
  const ended: EventListItem[] = [];
  for (const item of items) {
    if (deriveEventTimeStatus(item.event.startTs, item.event.endTs, now) === "past") {
      ended.push(item);
    } else {
      active.push(item);
    }
  }
  active.sort(compareByPriorityThenStart);
  ended.sort(compareByPriorityThenStart);
  return { active, ended };
}

export function partitionEndedPreview(
  ended: EventListItem[],
  previewCount = ENDED_EVENTS_PREVIEW
): { preview: EventListItem[]; rest: EventListItem[] } {
  return {
    preview: ended.slice(0, previewCount),
    rest: ended.slice(previewCount)
  };
}
