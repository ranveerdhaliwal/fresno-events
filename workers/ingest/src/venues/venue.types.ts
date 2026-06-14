import type { NormalizedEvent, ScrapeError } from "@fresno-events/shared";
import { z } from "zod";

export const venueStrategySchema = z.enum([
  "listing_then_detail",
  "month_windows_then_detail",
  "scroll_listing_then_detail",
  "html_parse",
  "api"
]);

export type VenueStrategy = z.infer<typeof venueStrategySchema>;

export const venueIngestLaneSchema = z.enum(["direct", "browser"]);

export type VenueIngestLane = z.infer<typeof venueIngestLaneSchema>;

export const extractorVariantSchema = z.enum(["default", "festival", "headline_only"]);

export const listingDiscoverySchema = z.enum(["plain", "br_if_empty"]);
export const detailModeSchema = z.enum(["none", "plain_html", "br_llm", "api_embedded"]);

export const venueConfigSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  enabled: z.boolean(),
  strategy: venueStrategySchema,
  listingUrl: z.string().url(),
  detailUrlCap: z.number().int().positive().optional(),
  llmCallCap: z.number().int().positive().optional(),
  allowedExternalHosts: z.array(z.string().min(1)).optional(),
  sourceHostname: z.string().min(1).optional(),
  extractorVariant: extractorVariantSchema.optional(),
  seriesId: z.string().optional(),
  monthWindows: z.number().int().positive().max(18).optional(),
  conditionalDetail: z.boolean().optional(),
  /** CLI --source= name (e.g. visitfresnocounty). One promote target per module. */
  promoteSource: z.string().min(1),
  /** NormalizedEvent.source for strategy=api (e.g. api:visitfresnocounty). */
  eventSource: z.string().min(1).optional(),
  /** Override lane grouping for preflight/promote scripts (default: derived from strategy). */
  ingestLane: venueIngestLaneSchema.optional(),
  listingDiscovery: listingDiscoverySchema.optional(),
  detailMode: detailModeSchema.optional(),
  blockedDetailHosts: z.array(z.string().min(1)).optional(),
  /**
   * Warn (not fail) when a real run yields fewer events than this — catches silent
   * breakage (e.g. a changed selector). Omit for seasonal venues (sports/fairs) that
   * legitimately have empty windows, to avoid false alarms.
   */
  minEventsWarn: z.number().int().nonnegative().optional()
});

export type VenueConfig = z.infer<typeof venueConfigSchema>;

export interface VenueRunDebug {
  listingUrls?: string[];
  /** HTTP URLs actually requested (API JSON, listing HTML, …). */
  fetchUrls?: string[];
  detailUrls?: string[];
  detailUrlsPlanned?: number;
  llmCalls?: number;
  errors?: string[];
  note?: string;
}

export interface VenueRunResult {
  events: NormalizedEvent[];
  errors: ScrapeError[];
  listingUrlsFound: number;
  detailUrlsVisited: number;
  llmCalls: number;
  debug: VenueRunDebug;
  brCrawlJobId?: string | null;
  brCrawlStatus?: string | null;
}

export interface VenueRunContext {
  ingestRunId: string;
  dryRun: boolean;
  userAgent: string;
  signal?: AbortSignal;
  venueFilter?: string[];
}
