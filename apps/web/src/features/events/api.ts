import {
  getEventDetail as getEventDetailRaw,
  listTodayEvents as listTodayEventsRaw,
  listWeekEvents as listWeekEventsRaw
} from "@/services/events.service";
import type { EventDetailResult, EventListResult } from "@/services/events.types";

import { toTodayEventItem } from "./api-legacy-mapper";
import type { EventDetailResult as LegacyDetailResult, TodayEventsResult } from "./types";

export { toTodayEventItem } from "./api-legacy-mapper";

export async function listTodayEvents(signal?: AbortSignal): Promise<TodayEventsResult> {
  const result = await listTodayEventsRaw(signal);
  return mapListResult(result);
}

export async function listWeekEvents(options: {
  from: Date;
  until: Date;
  signal?: AbortSignal;
}): Promise<TodayEventsResult> {
  const result = await listWeekEventsRaw(options);
  return mapListResult(result);
}

export async function getEventDetail(slug: string, signal?: AbortSignal): Promise<LegacyDetailResult> {
  const result = await getEventDetailRaw(slug, signal);
  return {
    detail: result.detail,
    item: toTodayEventItem(result.item, 0),
    source: result.source,
    generatedAt: result.generatedAt
  };
}

function mapListResult(result: EventListResult): TodayEventsResult {
  return {
    items: result.items.map((item, index) => toTodayEventItem(item, index)),
    nextCursor: result.nextCursor,
    source: result.source,
    generatedAt: result.generatedAt
  };
}
