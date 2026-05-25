export interface SourceValidationProfile {
  scraperKey: string;
  /** Expected NormalizedEvent.source for most events (optional for multi-source scrapers). */
  eventSource?: string;
  /** Log ingest_validation_warn when events.length is below this. */
  minEventsWarn?: number;
  maxErrors: number;
}

export const SOURCE_VALIDATION_PROFILES: SourceValidationProfile[] = [
  {
    scraperKey: "visit-fresno-api",
    eventSource: "api:visitfresnocounty",
    minEventsWarn: 150,
    maxErrors: 0
  },
  {
    scraperKey: "milb-api",
    eventSource: "api:milb",
    minEventsWarn: 60,
    maxErrors: 0
  },
  {
    scraperKey: "downtown-fresno-api",
    eventSource: "api:downtownfresno",
    minEventsWarn: 5,
    maxErrors: 40
  },
  {
    scraperKey: "seed-special-url",
    minEventsWarn: 0,
    maxErrors: 1
  }
];

export function getProfileForScraper(scraperKey: string): SourceValidationProfile | undefined {
  return SOURCE_VALIDATION_PROFILES.find((p) => p.scraperKey === scraperKey);
}
