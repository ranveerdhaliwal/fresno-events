import type { ApiResponse, EventDetailResponse, EventListItem, EventListResponse, HomepageCurationResponse } from "@fresno-events/shared";

import { getMockEventBySlug, getMockEventList } from "@/services/events.mock";
import type { EventDetailResult, EventListResult, HomepageCurationResult } from "@/services/events.types";

export async function listDayEvents(isoDate: string, signal?: AbortSignal): Promise<EventListResult> {
  const from = new Date(`${isoDate}T00:00:00-07:00`);
  const until = new Date(`${isoDate}T23:59:59.999-07:00`);
  return listEvents({ from, until, limit: 100, ...(signal ? { signal } : {}) });
}

export const eventsService = {
  listTodayEvents,
  listWeekEvents,
  listDayEvents,
  getEventDetail,
  getHomepageCuration
};

export async function listTodayEvents(signal?: AbortSignal): Promise<EventListResult> {
  return listEvents({ limit: 12, ...(signal ? { signal } : {}) });
}

export async function listWeekEvents(options: {
  from: Date;
  until: Date;
  signal?: AbortSignal;
}): Promise<EventListResult> {
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

    const item: EventListItem = {
      event: payload.data.event,
      venue: payload.data.venue,
      ...(payload.data.heroImage ? { heroImage: payload.data.heroImage } : {})
    };

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

export async function getHomepageCuration(signal?: AbortSignal): Promise<HomepageCurationResult> {
  const apiUrl = getApiUrl();

  if (!apiUrl) {
    return createMockHomepageResult(signal);
  }

  try {
    const response = await fetch(new URL("/events/homepage", apiUrl), createRequestInit(signal));

    if (!response.ok) {
      throw new Error(`Homepage API responded with ${response.status}`);
    }

    const payload = (await response.json()) as ApiResponse<HomepageCurationResponse>;

    if (!payload.ok) {
      throw new Error(payload.error.message);
    }

    return {
      ...payload.data,
      source: "api"
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    console.warn("Falling back to mock homepage curation because the Events API is unavailable.", error);
    return createMockHomepageResult(signal);
  }
}

async function listEvents(options: {
  from?: Date;
  until?: Date;
  limit: number;
  signal?: AbortSignal;
}): Promise<EventListResult> {
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
      items: payload.data.items,
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

function createMockResult(options: { from?: Date; until?: Date } = {}): EventListResult {
  const items = getMockEventList().filter((item) =>
    isWithinWindow(item.event.startTs, options.from, options.until)
  );

  return {
    items,
    nextCursor: null,
    source: "mock",
    generatedAt: new Date().toISOString()
  };
}

async function createMockHomepageResult(signal?: AbortSignal): Promise<HomepageCurationResult> {
  const list = await listTodayEvents(signal);
  const featured = list.items.slice(0, 5).map((item, index) => ({
    position: index + 1,
    source: "auto" as const,
    item
  }));
  const popular = list.items.slice(0, 5).map((item, index) => ({
    position: index + 1,
    source: "auto" as const,
    item
  }));

  return {
    featured,
    popular,
    generatedAt: list.generatedAt,
    source: "mock"
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
      relatedEvents: getMockEventList()
        .filter((related) => related.event.id !== item.event.id)
        .slice(0, 3)
        .map(({ event, venue, heroImage }) => (heroImage ? { event, venue, heroImage } : { event, venue }))
    },
    item,
    source: "mock",
    generatedAt: new Date().toISOString()
  };
}

function getApiUrl() {
  const value = import.meta.env.VITE_API_URL?.trim();
  return value ? value : null;
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
