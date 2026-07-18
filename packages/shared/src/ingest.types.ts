import type { LineupEntry } from "./lineup.js";
import type { CoordinatorMode, EventCategory, EventSource } from "./event.types.js";

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
  /** Door time when distinct from show start (e.g. VenuNite doorTime). */
  doorsTs?: string;
  /** Age restriction label from upstream (e.g. "21+"). */
  ageRestriction?: string;
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
