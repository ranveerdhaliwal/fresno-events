import type { ScraperRun } from "@fresno-events/shared";

import type { IngestEnv } from "@/env";
import { createAiDiscoveryRunner } from "@/scrapers/ai-discovery";
import { run as runBandsintown } from "@/scrapers/bandsintown";
import { run as runEventbrite } from "@/scrapers/eventbrite";
import { run as runSeatGeek } from "@/scrapers/seatgeek";
import { run as runTicketmaster } from "@/scrapers/ticketmaster";

export interface RegisteredScraper {
  /** Stable key used as `event_sources.key` in Supabase. */
  key: string;
  /** Human label shown in admin UI. */
  label: string;
  /** Default cadence in minutes when the DB does not provide one. */
  defaultCadenceMinutes: number;
  /** Whether to enable by default if no DB row exists. */
  enabledByDefault: boolean;
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
    enabledByDefault: true,
    requiredSecrets: ["TICKETMASTER_API_KEY"],
    run: runTicketmaster
  },
  {
    key: "seatgeek",
    label: "SeatGeek API",
    defaultCadenceMinutes: 720,
    enabledByDefault: false,
    requiredSecrets: ["SEATGEEK_CLIENT_ID", "SEATGEEK_CLIENT_SECRET"],
    run: runSeatGeek
  },
  {
    key: "eventbrite",
    label: "Eventbrite API",
    defaultCadenceMinutes: 720,
    enabledByDefault: false,
    requiredSecrets: ["EVENTBRITE_API_KEY"],
    run: runEventbrite
  },
  {
    key: "bandsintown",
    label: "Bandsintown API",
    defaultCadenceMinutes: 720,
    enabledByDefault: false,
    requiredSecrets: ["BANDSINTOWN_APP_ID"],
    run: runBandsintown
  },
  {
    key: "ai-discovery",
    label: "AI discovery (no-API venues)",
    defaultCadenceMinutes: 1440,
    enabledByDefault: false,
    runFactory: (env) => createAiDiscoveryRunner(env)
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
