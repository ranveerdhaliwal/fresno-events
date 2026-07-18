import type { Event, EventStatus, ImageAsset, Venue } from "./event.types.js";
import type { NormalizedEvent } from "./ingest.types.js";

export interface CursorPage<T> {
  items: T[];
  nextCursor?: string;
}

export interface EventListItem {
  event: Event;
  venue: Venue;
  heroImage?: ImageAsset;
}

export interface EventDetailResponse {
  event: Event;
  venue: Venue;
  heroImage?: ImageAsset;
  galleryImages: ImageAsset[];
  relatedEvents: EventListItem[];
  seriesEvents?: EventListItem[];
}

export interface EventListResponse {
  items: EventListItem[];
  nextCursor: string | null;
  generatedAt: string;
  meta?: EventListMeta;
}

export interface EventListMeta {
  omittedNoCoords?: number;
}

export interface SearchVenueHit {
  id: string;
  slug: string;
  name: string;
  city: string;
}

export interface SearchArtistHit {
  id: string;
  slug: string;
  name: string;
}

export interface SearchResponse {
  query: string;
  events: EventListItem[];
  venues: SearchVenueHit[];
  artists: SearchArtistHit[];
  generatedAt: string;
}

export type HomepageSection = "featured" | "popular";

export interface HomepageSlotItem {
  position: number;
  source: "pinned" | "auto";
  item: EventListItem;
}

export interface HomepageCurationResponse {
  featured: HomepageSlotItem[];
  /** @deprecated Use biggestMonth */
  popular?: HomepageSlotItem[];
  biggestMonth: EventListItem[];
  generatedAt: string;
}

export interface EventSectionBucket {
  preview: EventListItem[];
  total: number;
  hidden: number;
  fromIso: string;
  untilIso: string;
}

export interface EventSectionsResponse {
  today: EventSectionBucket;
  week: EventSectionBucket;
  weekend: EventSectionBucket;
  generatedAt: string;
}

export interface CalendarDayBucket {
  isoDate: string;
  total: number;
  preview: EventListItem[];
  hidden: number;
}

export interface CalendarWeekBucket {
  label: string;
  fromIso: string;
  untilIso: string;
  total: number;
  preview: EventListItem[];
  hidden: number;
}

export interface CalendarMonthResponse {
  year: number;
  month: number;
  days: CalendarDayBucket[];
  weeks: CalendarWeekBucket[];
  generatedAt: string;
}

export interface LocalContextWeather {
  ok: true;
  tempF: number;
  condition: string;
  icon: string;
}

export interface LocalContextAirQuality {
  ok: true;
  aqi: number;
  category: string;
}

export interface LocalContextUnavailable {
  ok: false;
}

export interface LocalContextResponse {
  weather: LocalContextWeather | LocalContextUnavailable;
  airQuality: LocalContextAirQuality | LocalContextUnavailable;
  generatedAt: string;
}

export interface VenueDetailResponse {
  venue: Venue;
  upcomingEvents: EventListItem[];
}

export interface HomepageSlotEventSummary {
  id: string;
  slug: string;
  title: string;
  startTs: string;
  status: EventStatus;
  heroImageUrl: string | null;
}

export interface HomepageSlotRow {
  section: HomepageSection;
  position: number;
  eventId: string | null;
  event: HomepageSlotEventSummary | null;
  stale: boolean;
}

export interface HomepageSlotsResponse {
  slots: HomepageSlotRow[];
  generatedAt: string;
}

export interface HomepageSlotsPutBody {
  slots: Array<{ section: HomepageSection; position: number; eventId: string | null }>;
  reviewedBy?: string;
}

export interface AdminPublishedEventResponse {
  event: Event;
  venue: Venue;
  heroImage?: ImageAsset;
}

export interface AdminEventSearchHit {
  id: string;
  slug: string;
  title: string;
  startTs: string;
  venueName: string;
  heroImageUrl: string | null;
}

export interface AdminEventSearchResponse {
  items: AdminEventSearchHit[];
}

export interface AdminEventListHit extends AdminEventSearchHit {
  priority: number;
  source: string;
  status: string;
}

export interface AdminEventListResponse {
  items: AdminEventListHit[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminEventPatchBody {
  event?: Partial<NormalizedEvent>;
  priority?: number;
  reviewedBy?: string;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiFailure {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
