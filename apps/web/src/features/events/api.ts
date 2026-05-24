import type { ApiResponse, Event, EventDetailResponse, EventListItem, EventListResponse } from "@fresno-events/shared";

import { getMockEventBySlug, getMockTodayEvents } from "./mock-events";
import type { EventDetailResult, EventsResult, TodayEventItem, TodayEventsResult } from "./types";

const timeZone = "America/Los_Angeles";
const accents: TodayEventItem["accent"][] = ["sunset", "fig", "sky", "olive", "rose"];

export async function listTodayEvents(signal?: AbortSignal): Promise<TodayEventsResult> {
  return listEvents({ limit: 12, ...(signal ? { signal } : {}) });
}

export async function listWeekEvents(options: { from: Date; until: Date; signal?: AbortSignal }): Promise<EventsResult> {
  return listEvents({
    from: options.from,
    until: options.until,
    limit: 50,
    ...(options.signal ? { signal: options.signal } : {})
  });
}

export async function getEventDetail(slug: string, signal?: AbortSignal): Promise<EventDetailResult> {
  const apiUrl = getApiUrl();

  if (!apiUrl) {
    return createMockDetailResult(slug);
  }

  try {
    const response = await fetch(new URL(`/events/${slug}`, apiUrl), createRequestInit(signal));

    if (!response.ok) {
      throw new Error(`Event API responded with ${response.status}`);
    }

    const payload = (await response.json()) as ApiResponse<EventDetailResponse>;

    if (!payload.ok) {
      throw new Error(payload.error.message);
    }

    const item = toTodayEventItem(
      {
        event: payload.data.event,
        venue: payload.data.venue,
        ...(payload.data.heroImage ? { heroImage: payload.data.heroImage } : {})
      },
      0
    );

    return {
      detail: payload.data,
      item,
      source: "api",
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    const mock = getMockEventBySlug(slug);

    if (!mock) {
      throw error;
    }

    console.warn("Falling back to mock event detail because the Events API is unavailable.", error);
    return createMockDetailResult(slug);
  }
}

async function listEvents(options: {
  from?: Date;
  until?: Date;
  limit: number;
  signal?: AbortSignal;
}): Promise<EventsResult> {
  const apiUrl = getApiUrl();

  if (!apiUrl) {
    return createMockResult(options);
  }

  try {
    const url = new URL("/events", apiUrl);
    url.searchParams.set("limit", String(options.limit));

    if (options.from) {
      url.searchParams.set("from", options.from.toISOString());
    }

    if (options.until) {
      url.searchParams.set("until", options.until.toISOString());
    }

    const response = await fetch(url, createRequestInit(options.signal));

    if (!response.ok) {
      throw new Error(`Events API responded with ${response.status}`);
    }

    const payload = (await response.json()) as ApiResponse<EventListResponse>;

    if (!payload.ok) {
      throw new Error(payload.error.message);
    }

    return {
      items: payload.data.items.map(toTodayEventItem),
      nextCursor: payload.data.nextCursor,
      source: "api",
      generatedAt: payload.data.generatedAt
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    console.warn("Falling back to mock events because the Events API is unavailable.", error);
    return createMockResult(options);
  }
}

function createRequestInit(signal?: AbortSignal): RequestInit {
  return {
    headers: { Accept: "application/json" },
    ...(signal ? { signal } : {})
  };
}

function createMockResult(options: { from?: Date; until?: Date } = {}): TodayEventsResult {
  const items = getMockTodayEvents().filter((item) => isWithinWindow(item.event.startTs, options.from, options.until));

  return {
    items,
    nextCursor: null,
    source: "mock",
    generatedAt: new Date().toISOString()
  };
}

function createMockDetailResult(slug: string): EventDetailResult {
  const item = getMockEventBySlug(slug);

  if (!item) {
    throw new Error(`Mock event ${slug} could not be found.`);
  }

  return {
    detail: {
      event: item.event,
      venue: item.venue,
      ...(item.heroImage ? { heroImage: item.heroImage, galleryImages: [item.heroImage] } : { galleryImages: [] }),
      relatedEvents: getMockTodayEvents()
        .filter((related) => related.event.id !== item.event.id)
        .slice(0, 3)
        .map(({ event, venue, heroImage }) => (heroImage ? { event, venue, heroImage } : { event, venue }))
    },
    item,
    source: "mock",
    generatedAt: new Date().toISOString()
  };
}

export function toTodayEventItem(item: EventListItem, index: number): TodayEventItem {
  const accent = accents[index % accents.length] ?? "sunset";
  const base = {
    event: item.event,
    venue: item.venue,
    accent,
    kicker: getKicker(item.event, index),
    neighborhood: item.venue.neighborhood ?? item.venue.city,
    priceLabel: formatPrice(item.event),
    timeLabel: formatTime(item.event.startTs),
    dateLabel: formatDate(item.event.startTs),
    saveCount: estimateSaveCount(item.event.id),
    ...(item.event.priority <= 1 ? { featured: true as const } : {})
  };

  return item.heroImage ? { ...base, heroImage: item.heroImage } : base;
}

function getApiUrl() {
  const value = import.meta.env.VITE_API_URL?.trim();
  return value ? value : null;
}

function getKicker(event: Event, index: number) {
  if (event.priority === 0) {
    return "Sponsored";
  }

  if (event.priority === 1) {
    return "Start here";
  }

  if (isTonight(event.startTs)) {
    return "Tonight";
  }

  const labels: Partial<Record<Event["category"], string>> = {
    family: "Family-friendly",
    music: "Live music",
    sports: "Game night",
    food_drink: "Food & drink",
    art: "Arts pick",
    theater: "On stage",
    festival: "Festival watch",
    outdoor: "Outside"
  };

  return labels[event.category] ?? "Local pick";
}

function isTonight(value: string) {
  const eventDate = new Date(value);
  const now = new Date();
  return eventDate.toDateString() === now.toDateString() && eventDate.getHours() >= 17;
}

function isWithinWindow(value: string, from?: Date, until?: Date) {
  const date = new Date(value);

  if (from && date < from) {
    return false;
  }

  if (until && date >= until) {
    return false;
  }

  return true;
}

function formatPrice(event: Event) {
  if (event.isFree || (event.priceMin === 0 && event.priceMax === 0)) {
    return "Free";
  }

  if (typeof event.priceMin === "number" && typeof event.priceMax === "number") {
    return event.priceMin === event.priceMax ? `$${event.priceMin}` : `$${event.priceMin}-${event.priceMax}`;
  }

  if (typeof event.priceMin === "number") {
    return `From $${event.priceMin}`;
  }

  return "Details soon";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone
  }).format(new Date(value));
}

function estimateSaveCount(id: string) {
  const seed = [...id].reduce((total, char) => total + char.charCodeAt(0), 0);
  return 90 + seed % 280;
}
