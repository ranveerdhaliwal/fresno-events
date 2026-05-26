import type { ScraperRun } from "@fresno-events/shared";

import type { IngestEnv } from "@/env";
import { createVenueIngestRunner } from "@/scrapers/venue-ingest";
import { createAiDiscoveryRunner } from "@/scrapers/ai-discovery";
import { civicDiscoveryUrls } from "@/sources/civic-urls";
import { run as runBandsintown } from "@/scrapers/bandsintown";
import { run as runEventbrite } from "@/scrapers/eventbrite";
import { run as runSeatGeek } from "@/scrapers/seatgeek";
import { run as runTicketmaster } from "@/scrapers/ticketmaster";

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
    defaultCadenceMinutes: 360,
    schedule: "cron",
    requiredSecrets: ["TICKETMASTER_API_KEY"],
    run: runTicketmaster
  },
  {
    key: "seatgeek",
    label: "SeatGeek API",
    defaultCadenceMinutes: 720,
    schedule: "manual-only",
    requiredSecrets: ["SEATGEEK_CLIENT_ID", "SEATGEEK_CLIENT_SECRET"],
    run: runSeatGeek
  },
  {
    key: "eventbrite",
    label: "Eventbrite API",
    defaultCadenceMinutes: 720,
    schedule: "manual-only",
    requiredSecrets: ["EVENTBRITE_API_KEY"],
    run: runEventbrite
  },
  {
    key: "bandsintown",
    label: "Bandsintown API",
    defaultCadenceMinutes: 720,
    schedule: "manual-only",
    requiredSecrets: ["BANDSINTOWN_APP_ID"],
    run: runBandsintown
  },
  {
    key: "ai-discovery",
    label: "AI discovery (no-API venues)",
    defaultCadenceMinutes: 1440,
    schedule: "manual-only",
    defaultConfig: {
      maxPerUrl: 20,
      urls: [...civicDiscoveryUrls]
    },
    runFactory: (env) => createAiDiscoveryRunner(env)
  },
  {
    key: "venue-ingest",
    label: "Venue ingest (repo configs: crawl + API)",
    defaultCadenceMinutes: 360,
    schedule: "cron",
    requiredSecrets: [
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_API_TOKEN",
      "VISIT_FRESNO_API_TOKEN"
    ],
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
