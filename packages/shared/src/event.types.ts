import type { LineupEntry } from "./lineup.js";

export const eventCategories = [
  "music",
  "comedy",
  "theater",
  "sports",
  "food_drink",
  "festival",
  "family",
  "art",
  "nightlife",
  "community",
  "outdoor",
  "wellness",
  "education"
] as const;

export type EventCategory = (typeof eventCategories)[number];

export type EventStatus =
  | "scheduled"
  | "cancelled"
  | "postponed"
  | "sold_out"
  | "inferred_cancelled";

export type EventSource =
  | "ticketmaster"
  | "venunite"
  | "eventbrite"
  | "bandsintown"
  | "seatgeek"
  | `scrape:${string}`
  | `api:${string}`
  | `manual:${string}`
  | "manual"
  | "recurring";

export type SeedLane = "api" | "special_url" | "crawl" | "manual";

export type CoordinatorMode = "real" | "dry-run";

export const EVENT_PRIORITY_MIN = 0;
export const EVENT_PRIORITY_MAX = 5;
export const EVENT_PRIORITY_DEFAULT = 5;

export interface ImageAsset {
  id: string;
  storageKey: string;
  cdnUrl: string;
  width: number;
  height: number;
  blurhash?: string;
  dominantColor?: string;
  altText?: string;
  sourceUrl?: string;
  license?: string;
  createdAt: string;
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  address?: string;
  city: string;
  neighborhood?: string;
  lat?: number;
  lng?: number;
  capacity?: number;
  website?: string;
  phone?: string;
  socials?: Record<string, string>;
  heroImageId?: string;
  description?: string;
  primaryCategory?: EventCategory;
  createdAt: string;
  updatedAt: string;
}

export interface Artist {
  id: string;
  slug: string;
  name: string;
  genres: string[];
  heroImageId?: string;
  bio?: string;
  spotifyId?: string;
  bandsintownId?: string;
  musicbrainzId?: string;
}

export interface Event {
  id: string;
  slug: string;
  source: EventSource;
  sourceEventId?: string;
  sourceRefs: Record<string, string>;
  title: string;
  descriptionHtml?: string;
  descriptionText?: string;
  postedAt?: string;
  lastVerifiedAt?: string;
  sourceSyncId?: string;
  venueId: string;
  startTs: string;
  endTs?: string;
  timezone: string;
  doorsTs?: string;
  category: EventCategory;
  subcategories: string[];
  tags: string[];
  priceMin?: number;
  priceMax?: number;
  currency: string;
  isFree?: boolean;
  ticketUrl?: string;
  ageRestriction?: string;
  status: EventStatus;
  heroImageId?: string;
  galleryImageIds: string[];
  primaryArtistId?: string;
  allArtistIds: string[];
  externalUrl?: string;
  dedupeHash?: string;
  confidenceScore?: number;
  lastSeenAt?: string;
  priority: number;
  seriesId?: string;
  seriesName?: string;
  lineup?: LineupEntry[];
  /** Map marker emoji override; empty = auto-detect; "pin" = default Leaflet pin */
  mapPinEmoji?: string | null;
  createdAt: string;
  updatedAt: string;
}
