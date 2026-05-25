import type { EventDetailResponse, EventListItem } from "@fresno-events/shared";

export interface EventListResult {
  items: EventListItem[];
  nextCursor: string | null;
  source: "api" | "mock";
  generatedAt: string;
}

export interface EventDetailResult {
  detail: EventDetailResponse;
  item: EventListItem;
  source: "api" | "mock";
  generatedAt: string;
}
