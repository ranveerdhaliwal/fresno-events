import type { IngestEnv } from "@/env";
import { run as runGobulldogsApi } from "@/scrapers/gobulldogs-api";
import { runApiVenue } from "@/venues/_shared/api-venue.run";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";

import configJson from "./venue.config.json";

const config = configJson as VenueConfig;

export async function run(env: IngestEnv, ctx: VenueRunContext): Promise<VenueRunResult> {
  return runApiVenue(env, config, ctx, runGobulldogsApi);
}

export { config };
