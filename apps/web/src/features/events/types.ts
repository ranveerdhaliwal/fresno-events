import type { EventDetailResponse, EventListItem } from "@fresno-events/shared";

export type EventAccent = "sunset" | "fig" | "sky" | "olive" | "rose";

export interface TodayEventItem extends EventListItem {
  accent: EventAccent;
  kicker: string;
  neighborhood: string;
  priceLabel: string;
  timeLabel: string;
  dateLabel: string;
  saveCount: number;
  featured?: boolean;
}

export interface TodayEventsResult {
  items: TodayEventItem[];
  nextCursor: string | null;
  source: "api" | "mock";
  generatedAt: string;
}

export interface EventsResult {
  items: TodayEventItem[];
  nextCursor: string | null;
  source: "api" | "mock";
  generatedAt: string;
}

export interface EventDetailResult {
  detail: EventDetailResponse;
  item: TodayEventItem;
  source: "api" | "mock";
  generatedAt: string;
}
