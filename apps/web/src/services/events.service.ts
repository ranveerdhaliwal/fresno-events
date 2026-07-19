import {
  resolvePacificDateWindow,
  type ApiResponse,
  type CalendarMonthResponse,
  type EventDetailResponse,
  type EventListItem,
  type EventListResponse,
  type EventSectionsResponse,
  type HomepageCurationResponse,
  type VenueDetailResponse
} from "@fresno-events/shared";

import { getMockEventBySlug, getMockEventList } from "@/services/events.mock";
import type { EventDetailResult, EventListResult, HomepageCurationResult } from "@/services/events.types";

export async function listDayEvents(isoDate: string, signal?: AbortSignal): Promise<EventListResult> {
  const from = new Date(`${isoDate}T00:00:00-07:00`);
  const until = new Date(`${isoDate}T23:59:59.999-07:00`);
  return listEvents({ from, until, limit: 100, ...(signal ? { signal } : {}) });
}

export const eventsService = {
  listWeekEvents,
  listWeekThroughSunday,
  listDayEvents,
  listSeriesEvents,
  getEventDetail,
  getHomepageCuration,
  getEventSections,
  getCalendarMonth,
  getVenueDetail
};

export async function listWeekEvents(options: {
  from: Date;
  until: Date;
  signal?: AbortSignal;
  limit?: number;
}): Promise<EventListResult> {
  return listEvents({
    from: options.from,
    until: options.until,
    limit: options.limit ?? 50,
    ...(options.signal ? { signal: options.signal } : {})
  });
}

export async function listWeekThroughSunday(signal?: AbortSignal): Promise<EventListResult> {
  const window = resolvePacificDateWindow("thisWeek");
  return listEvents({
    from: window.from,
    until: window.until,
    limit: 100,
    ...(signal ? { signal } : {})
  });
}

export async function listSeriesEvents(seriesId: string, signal?: AbortSignal): Promise<EventListResult> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return createMockResult({});
  }

  try {
    const url = new URL("/events", apiUrl);
    url.searchParams.set("series_id", seriesId);
    url.searchParams.set("limit", "50");
    const response = await fetch(url, createRequestInit(signal));
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
    return createMockResult({});
  }
}

export async function getEventSections(signal?: AbortSignal): Promise<EventSectionsResponse & { source: "api" | "mock" }> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return createMockSectionsResult(signal);
  }

  try {
    const response = await fetch(new URL("/events/sections", apiUrl), createRequestInit(signal));
    if (!response.ok) {
      throw new Error(`Sections API responded with ${response.status}`);
    }
    const payload = (await response.json()) as ApiResponse<EventSectionsResponse>;
    if (!payload.ok) {
      throw new Error(payload.error.message);
    }
    return { ...payload.data, source: "api" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return createMockSectionsResult(signal);
  }
}

export async function getCalendarMonth(
  year: number,
  month: number,
  signal?: AbortSignal
): Promise<CalendarMonthResponse & { source: "api" | "mock" }> {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    return createMockCalendarResult(year, month);
  }

  try {
    const url = new URL("/events/calendar", apiUrl);
    url.searchParams.set("year", String(year));
    url.searchParams.set("month", String(month));
    const response = await fetch(url, createRequestInit(signal));
    if (!response.ok) {
      throw new Error(`Calendar API responded with ${response.status}`);
    }
    const payload = (await response.json()) as ApiResponse<CalendarMonthResponse>;
    if (!payload.ok) {
      throw new Error(payload.error.message);
    }
    return { ...payload.data, source: "api" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return createMockCalendarResult(year, month);
  }
}

export async function getVenueDetail(slug: string, signal?: AbortSignal) {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    throw new Error("Venue detail requires API");
  }

  const response = await fetch(new URL(`/venues/${slug}`, apiUrl), createRequestInit(signal));
  if (!response.ok) {
    throw new Error(`Venue API responded with ${response.status}`);
  }
  const payload = (await response.json()) as ApiResponse<VenueDetailResponse>;
  if (!payload.ok) {
    throw new Error(payload.error.message);
  }
  return payload.data;
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
  const list = await listWeekThroughSunday(signal);
  const featured = list.items.slice(0, 6).map((item, index) => ({
    position: index + 1,
    source: "auto" as const,
    item
  }));

  return {
    featured,
    biggestMonth: list.items.slice(0, 10),
    generatedAt: list.generatedAt,
    source: "mock"
  };
}

async function createMockSectionsResult(signal?: AbortSignal) {
  const list = await listWeekThroughSunday(signal);
  const bucket = {
    preview: list.items.slice(0, 8),
    total: list.items.length,
    hidden: Math.max(0, list.items.length - 8),
    fromIso: resolvePacificDateWindow("today").fromIso,
    untilIso: resolvePacificDateWindow("today").untilIso
  };
  const weekBucket = {
    preview: list.items.slice(0, 10),
    total: list.items.length,
    hidden: Math.max(0, list.items.length - 10),
    fromIso: resolvePacificDateWindow("thisWeek").fromIso,
    untilIso: resolvePacificDateWindow("thisWeek").untilIso
  };
  const weekendBucket = {
    preview: list.items.slice(2, 10),
    total: Math.max(0, list.items.length - 2),
    hidden: 0,
    fromIso: resolvePacificDateWindow("thisWeekend").fromIso,
    untilIso: resolvePacificDateWindow("thisWeekend").untilIso
  };

  return {
    today: bucket,
    week: weekBucket,
    weekend: weekendBucket,
    generatedAt: new Date().toISOString(),
    source: "mock" as const
  };
}

function createMockCalendarResult(year: number, month: number): CalendarMonthResponse & { source: "mock" } {
  const days = Array.from({ length: 35 }, (_, index) => {
    const day = index + 1;
    const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, 28)).padStart(2, "0")}`;
    return { isoDate, total: 0, preview: [], hidden: 0 };
  });

  return {
    year,
    month,
    days,
    weeks: [],
    generatedAt: new Date().toISOString(),
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
