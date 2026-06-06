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
  | "eventbrite"
  | "bandsintown"
  | "seatgeek"
  | `scrape:${string}`
  | `api:${string}`
  | `manual:${string}`
  | "manual"
  | "recurring";

export type SeedLane = "api" | "special_url" | "crawl" | "manual";

export type { LineupEntry } from "./lineup.js";
export { LineupEntrySchema, LineupSchema, parseLineup } from "./lineup.js";
export {
  computeOccurrenceFingerprints,
  computeOccurrenceKey,
  computeLooseOccurrenceKey,
  computeUrlKey,
  normalizeTitle,
  normalizeVenue,
  sourcePriorityRank,
  type OccurrenceFingerprints
} from "./occurrence.js";
export {
  isRecurringSeries,
  venueScope,
  listingUrlSeriesAnchor,
  computeAdHocSeriesId,
  computeCanonicalSeriesId,
  type SeriesResolveInput,
  type SeriesResolveResult
} from "./series.js";

export type EventCandidateStatus =
  | "awaiting_enrichment"
  | "pending_review"
  | "approved"
  | "rejected"
  | "needs_changes"
  | "duplicate";

export const EVENT_PRIORITY_MIN = 0;
export const EVENT_PRIORITY_MAX = 5;
export const EVENT_PRIORITY_DEFAULT = 5;

export {
  clampEventPriority,
  clampSuggestedPriorityForOrganicEvent,
  EVENT_DISPLAY_PRIORITY,
  formatEventDisplayPriorityRubric,
  getEventDisplayPriorityLabel,
  type EventDisplayPriorityTier
} from "./priority.js";

export type CoordinatorMode = "real" | "dry-run" | "resume-jobs";

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
  createdAt: string;
  updatedAt: string;
}

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
}

export type HomepageSection = "featured" | "popular";

export interface HomepageSlotItem {
  position: number;
  source: "pinned" | "auto";
  item: EventListItem;
}

export interface HomepageCurationResponse {
  featured: HomepageSlotItem[];
  popular: HomepageSlotItem[];
  generatedAt: string;
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

export interface NormalizedEvent {
  source: EventSource;
  sourceEventId: string;
  title: string;
  descriptionHtml?: string;
  descriptionText?: string;
  venueName: string;
  venueAddress?: string;
  venueCity?: string;
  startTs: string;
  endTs?: string;
  timezone?: string;
  category?: EventCategory;
  subcategories?: string[];
  tags?: string[];
  priceMin?: number;
  priceMax?: number;
  /** Free-form price when CMS text is not numeric (e.g. "see website for details"). */
  priceNotes?: string;
  currency?: string;
  isFree?: boolean;
  ticketUrl?: string;
  externalUrl?: string;
  imageUrl?: string;
  seriesId?: string;
  seriesName?: string;
  seriesListingRecId?: string;
  seriesPresentedBy?: string;
  lineup?: LineupEntry[];
}

export interface ScrapeError {
  source: string;
  url?: string;
  message: string;
  recoverable: boolean;
}

export interface ScrapeContext {
  runId: string;
  now: Date;
  userAgent: string;
  signal?: AbortSignal;
  secrets: Record<string, string | undefined>;
  config: Record<string, unknown>;
  /** ai-crawl coordinator mode (defaults to real when omitted). */
  coordinatorMode?: CoordinatorMode;
}

export interface ScrapeSeedMetric {
  url: string;
  label?: string | null;
  eventsFound: number;
  /** Present for venue-ingest per-venue metrics. */
  venueKey?: string;
  /** event_candidates.source for strategy=api venues. */
  eventSource?: string;
  /** Dry-run listing discovery: detail pages that would be scraped on promote. */
  detailUrlsPlanned?: number;
  /** True when eventsFound is a dry-run plan, not parsed events. */
  dryRunPlan?: boolean;
  /** Listing page(s) scraped or planned (preflight summary). */
  listingUrls?: string[];
  /** Detail page URLs discovered (capped in worker). */
  detailUrls?: string[];
  /** Parsed events with links (API / listing scrape in dry-run). */
  eventLinks?: Array<{ title: string; url: string; startTs?: string }>;
  /** venue.config.json strategy (api, html_parse, listing_then_detail, …). */
  strategy?: string;
  /** direct = HTTP/API only; browser = may use Browser Rendering + LLM on promote. */
  ingestLane?: "direct" | "browser";
  /** How detail pages are fetched (api_embedded, plain_html, br_llm, none). */
  detailMode?: string;
  /** HTTP URLs this run actually requests (API endpoints, listing pages, …). */
  fetchUrls?: string[];
}

export interface ScrapeResult {
  source: string;
  runId: string;
  events: NormalizedEvent[];
  errors: ScrapeError[];
  metrics: {
    pagesVisited: number;
    durationMs: number;
    /** Venue-ingest persisted and enriched each venue inside the scraper run. */
    venuePersistPerVenue?: boolean;
    /** Primary HTTP URLs fetched during this scrape (for preflight/promote logs). */
    fetchUrls?: string[];
  };
  seedMetrics?: ScrapeSeedMetric[];
}

export type ScraperRun = (ctx: ScrapeContext) => Promise<ScrapeResult>;

export interface IngestRunRecord {
  id: string;
  source: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "completed" | "completed_with_errors" | "failed";
  eventsFound: number;
  errorsCount: number;
  metrics: Record<string, unknown>;
  createdAt: string;
}

export interface LinkedEventCandidate {
  id: string;
  source: EventSource;
  sourceEventId: string;
  title: string;
  status: EventCandidateStatus;
  sourceUrl?: string;
  ticketUrl?: string;
}

export interface SeriesSiblingCandidate {
  id: string;
  source: EventSource;
  sourceEventId: string;
  title: string;
  startTs: string;
  venueName: string;
  status: EventCandidateStatus;
  sourceUrl?: string;
}

/** Whether ingest has enough structured fields, or detail_page_url still needs a fetch. */
export type CandidateDetailStatus = "complete" | "pending";

export interface EventCandidate {
  id: string;
  runId?: string;
  source: EventSource;
  sourceEventId: string;
  title: string;
  venueName: string;
  startTs: string;
  sourceUrl?: string;
  ticketUrl?: string;
  detailStatus: CandidateDetailStatus;
  /** Canonical show/detail URL for backfill when detailStatus is pending. */
  detailPageUrl?: string;
  normalizedEvent: NormalizedEvent;
  rawPayload: Record<string, unknown>;
  dedupeHash: string;
  confidenceScore: number;
  /** 0–5 from AI enrichment; omitted until enriched. */
  suggestedPriority?: number;
  status: EventCandidateStatus;
  reviewNotes?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  matchedEventId?: string;
  occurrenceId: string;
  canonicalCandidateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventCandidateListResponse {
  items: EventCandidate[];
  generatedAt: string;
  offset?: number;
  limit?: number;
}

export type ContentDiffField =
  | "title"
  | "startTs"
  | "endTs"
  | "venueName"
  | "venueCity"
  | "venueAddress"
  | "descriptionText"
  | "ticketUrl"
  | "externalUrl"
  | "category";

export interface ContentDiffEntry {
  field: ContentDiffField;
  label: string;
  before: string | null;
  after: string | null;
}

export interface ContentDiffSummary {
  changedFields: ContentDiffField[];
  entries: ContentDiffEntry[];
}

export interface EventCandidateDetailResponse {
  candidate: EventCandidate;
  linkedCandidates?: LinkedEventCandidate[];
  seriesSiblings?: SeriesSiblingCandidate[];
  publishedEvent?: Event;
  contentDiff?: ContentDiffSummary;
}

export interface ReviewDecisionResponse {
  candidate: EventCandidate;
  event?: Event;
}

export type CandidateDeleteSkipReason = "approved" | "not_found";

export interface CandidateBulkDeleteResponse {
  deleted: number;
  skipped: Array<{ id: string; reason: CandidateDeleteSkipReason }>;
}

export type CandidateApproveSkipReason = "not_found" | "not_pending" | "already_approved";

export interface CandidateBulkApproveResponse {
  approved: number;
  skipped: Array<{ id: string; reason: CandidateApproveSkipReason }>;
  failed: Array<{ id: string; message: string }>;
}

export type CandidateApproveChangesSkipReason =
  | "not_found"
  | "not_needs_changes"
  | "missing_matched_event"
  | "already_approved";

export interface CandidateBulkApproveChangesResponse {
  approved: number;
  skipped: Array<{ id: string; reason: CandidateApproveChangesSkipReason }>;
  failed: Array<{ id: string; message: string }>;
}
