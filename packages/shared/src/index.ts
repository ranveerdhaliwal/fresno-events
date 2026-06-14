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

export type { LineupEntry } from "./lineup.js";
export { LineupEntrySchema, LineupSchema, parseLineup } from "./lineup.js";
export {
  computeOccurrenceFingerprints,
  computeOccurrenceKey,
  computeDateOnlyOccurrenceKey,
  computeLooseOccurrenceKey,
  computeUrlKey,
  normalizeTitle,
  normalizeVenue,
  canonicalOccurrenceTitle,
  isUtcNoonAllDaySentinel,
  pacificDateFromStartTs,
  normalizeListingUrl,
  isUniquePerPerformanceListingUrl,
  normalizedListingUrlForEvent,
  listingUrlsReferToSamePerformance,
  pacificTimeBucketKey,
  sourcePriorityRank,
  sha256Hex,
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
  ORGANIC_CANDIDATE_DISPLAY_PRIORITY,
  formatEventDisplayPriorityRubric,
  getEventDisplayPriorityLabel,
  type EventDisplayPriorityTier
} from "./priority.js";
export {
  suggestEventPriority,
  type PriorityRuleInput,
  type PrioritySuggestion,
  type PriorityRuleKind
} from "./priority-rules.js";
export {
  formatIngestExclusionNotes,
  getIngestExclusion,
  type IngestExclusion,
  type IngestExclusionInput
} from "./ingest-exclusions.js";
export {
  compareEventsByPriorityStart,
  selectEventPreview,
  type EventPreviewSortable,
  type PreviewCaps
} from "./event-preview.js";
export {
  PACIFIC_TZ,
  addDaysToIsoDate,
  daysFromIsoThroughSunday,
  pacificEndOfDay,
  pacificMonthBounds,
  pacificStartOfDay,
  pacificTodayIso,
  buildNextPacificMonths,
  isoDateInPacificMonth,
  resolvePacificDateWindow,
  upcomingSundayIso,
  type DateWindowPreset,
  type PacificDateRange,
  type PacificMonthTile
} from "./pacific-date-ranges.js";
export { DEFAULT_EVENT_DURATION_MS, resolveEndTs } from "./default-end-ts.js";
export {
  MAP_PIN_EMOJI_PRESETS,
  resolveMapPinEmoji,
  type MapPinEmojiInput
} from "./map-pin-emoji.js";
export {
  buildGoogleMapsSearchUrl,
  buildMapsSearchQuery,
  isValidCoordinate,
  normalizeVenueStreetAddress,
  parseMailingAddress,
  parseStreetFromFullAddress,
  resolveVenueLocationFields,
  type MapsLinkInput,
  type ResolvedVenueLocation,
  type VenueLocationParts
} from "./venue-location.utils.js";

export type CoordinatorMode = "real" | "dry-run";

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

export interface NormalizedEvent {
  source: EventSource;
  sourceEventId: string;
  title: string;
  descriptionHtml?: string;
  descriptionText?: string;
  venueName: string;
  venueAddress?: string;
  venueCity?: string;
  venueLat?: number;
  venueLng?: number;
  startTs: string;
  endTs?: string;
  /** Source gave a calendar date but no wall-clock start (not the same as all-day). */
  timeUnknown?: boolean;
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
  /** Show venue logo thumbnail in list rows even at community priority (5). */
  showVenueLogoInList?: boolean;
  /** Inset (px) around venue logos in list thumbnails; lower = larger logo. */
  listVenueLogoPadding?: number;
  seriesId?: string;
  seriesName?: string;
  seriesListingRecId?: string;
  seriesPresentedBy?: string;
  lineup?: LineupEntry[];
  mapPinEmoji?: string | null;
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
  /** Ingest dry-run vs real persist (defaults to real when omitted). */
  coordinatorMode?: CoordinatorMode;
}

/** AI enrichment counts from a promote run (per venue or whole source). */
export interface ScrapeEnrichmentMetric {
  processed: number;
  updated: number;
  skipped_sufficient_data: number;
  skipped_pending_detail: number;
  errors: number;
  auto_rejected: number;
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
  /** Detail pages fetched on promote (0 when detailMode is none). */
  detailUrlsVisited?: number;
  /** Post-persist LLM enrichment for this venue's source filter. */
  enrichment?: ScrapeEnrichmentMetric;
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
  /** Same-show fingerprint; filters false-positive occurrence_id siblings in admin. */
  occurrenceKey?: string;
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

/** Review queue tab totals (admin UI). */
export interface EventCandidateTabCounts {
  pending_review: number;
  needs_changes: number;
  approved: number;
  rejected: number;
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
  | "category"
  | "priceMin"
  | "priceMax";

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

/** Venue pin shown on publish when the candidate has no coords of its own. */
export interface PublishVenuePreview {
  lat: number;
  lng: number;
  venueName: string;
  venueSlug: string;
  source: "existing_venue";
}

export interface EventCandidateDetailResponse {
  candidate: EventCandidate;
  linkedCandidates?: LinkedEventCandidate[];
  seriesSiblings?: SeriesSiblingCandidate[];
  publishedEvent?: Event;
  contentDiff?: ContentDiffSummary;
  /** Matches post-approve map when ingest omitted venueLat/Lng but venues row exists. */
  publishVenuePreview?: PublishVenuePreview;
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

export interface CandidateBulkPriorityResponse {
  priority: number;
  updated: number;
  failed: Array<{ id: string; message: string }>;
}

export interface EventBulkPriorityResponse {
  priority: number;
  updated: number;
  failed: Array<{ id: string; message: string }>;
}

export interface CandidateBulkRejectResponse {
  rejected: number;
  failed: Array<{ id: string; message: string }>;
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

export type ReviewQueueAuditSeverity = "error" | "warn";

export type ReviewQueueAuditCode =
  | "slug_conflict_published"
  | "slug_conflict_pending_peer"
  | "pending_linked_duplicate"
  | "multi_primary_occurrence"
  | "ticketmaster_needs_ai";

export interface ReviewQueueAuditIssue {
  code: ReviewQueueAuditCode;
  severity: ReviewQueueAuditSeverity;
  candidateId: string;
  title: string;
  message: string;
  detail?: Record<string, string>;
}

export interface ReviewQueueAuditResponse {
  generatedAt: string;
  summary: {
    pendingPrimaries: number;
    scheduledEvents: number;
    errors: number;
    warnings: number;
  };
  issues: ReviewQueueAuditIssue[];
}

export type {
  ReviewOccurrenceRelinkLinkExample,
  ReviewOccurrenceRelinkOpsResponse,
  ReviewOccurrenceRelinkSummary,
  ReviewPriorityRerankOpsResponse,
  ReviewPriorityRerankRuleGroup,
  ReviewPriorityRerankSection,
  ReviewPriorityRerankSectionSummary,
  ReviewPriorityTriageOpsResponse,
  ReviewPriorityTriageRuleGroup,
  ReviewPriorityTriageSummary,
  ReviewVenueAddressBackfillOpsResponse,
  ReviewVenueAddressBackfillSummary,
  ReviewVenueGeocodeOpsResponse,
  ReviewVenueGeocodeSummary
} from "./review-ops.types.js";
