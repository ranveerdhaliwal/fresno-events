export interface SourceValidationProfile {
  scraperKey: string;
  /** Expected NormalizedEvent.source for most events (optional for multi-source scrapers). */
  eventSource?: string;
  /** When true, apply per-source thresholds in VENUE_EVENT_SOURCE_WARN_THRESHOLDS. */
  multiSource?: boolean;
  /** Log ingest_validation_warn when events.length is below this. */
  minEventsWarn?: number;
  maxErrors: number;
}

/** Per NormalizedEvent.source soft warn thresholds for venue-ingest batches. */
export const VENUE_EVENT_SOURCE_WARN_THRESHOLDS: Record<string, number> = {
  "api:visitfresnocounty": 150,
  "api:milb": 60,
  "api:downtownfresno": 5,
  "api:gobulldogs": 5
};

export const SOURCE_VALIDATION_PROFILES: SourceValidationProfile[] = [
  {
    scraperKey: "venue-ingest",
    multiSource: true,
    minEventsWarn: 5,
    maxErrors: 40
  },
  {
    scraperKey: "venunite",
    eventSource: "venunite",
    minEventsWarn: 80,
    maxErrors: 5
  },
  {
    scraperKey: "ticketmaster",
    eventSource: "ticketmaster",
    minEventsWarn: 15,
    maxErrors: 5
  }
];

export function getProfileForScraper(scraperKey: string): SourceValidationProfile | undefined {
  return SOURCE_VALIDATION_PROFILES.find((p) => p.scraperKey === scraperKey);
}
