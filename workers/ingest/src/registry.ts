import type { ScraperRun } from "@fresno-events/shared";

import type { IngestEnv } from "@/env";
import { createVenueIngestRunner } from "@/scrapers/venue-ingest";
import { run as runTicketmaster } from "@/scrapers/ticketmaster";
import { run as runVenunite } from "@/scrapers/venunite";

export interface RegisteredScraper {
  /** Stable source key (stored on candidates and ingest_runs). */
  key: string;
  label: string;
  /** Minutes between cron runs; manual `--force` ignores this. */
  defaultCadenceMinutes: number;
  /** Per-source options (URLs, radius, etc.) — defined in code, not the database. */
  defaultConfig?: Record<string, unknown>;
  /** Cron includes this source when due; `manual-only` runs only via explicit `--source` / `--all`. */
  schedule: "cron" | "manual-only";
  /** Per-source secret env keys this scraper needs. Used for a quick missing-secret message. */
  requiredSecrets?: ReadonlyArray<keyof IngestEnv>;
  /** Static run handler; mutually exclusive with `runFactory`. */
  run?: ScraperRun;
  /** Factory used when the scraper needs a Worker binding (Workers AI, R2, etc.). */
  runFactory?: (env: IngestEnv) => ScraperRun;
}

export const scrapers: RegisteredScraper[] = [
  {
    key: "ticketmaster",
    label: "Ticketmaster Discovery API",
    defaultCadenceMinutes: 1440,
    schedule: "cron",
    requiredSecrets: ["TICKETMASTER_API_KEY"],
    run: runTicketmaster
  },
  {
    key: "venunite",
    label: "VenuNite aggregator API",
    defaultCadenceMinutes: 20160,
    schedule: "cron",
    requiredSecrets: [],
    run: runVenunite
  },
  {
    key: "venue-ingest",
    label: "Venue ingest (12 repo venue modules)",
    defaultCadenceMinutes: 360,
    schedule: "cron",
    requiredSecrets: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
    runFactory: (env) => createVenueIngestRunner(env)
  }
];

export function resolveScraperRun(scraper: RegisteredScraper, env: IngestEnv): ScraperRun {
  if (scraper.run) {
    return scraper.run;
  }
  if (scraper.runFactory) {
    return scraper.runFactory(env);
  }
  throw new Error(`Scraper ${scraper.key} has neither run nor runFactory.`);
}

export function findScraper(key: string) {
  return scrapers.find((scraper) => scraper.key === key);
}
