import type { IngestEnv } from "@/env";
import { run as runVisitFresnoApi } from "@/scrapers/visit-fresno-api";
import { runApiVenue } from "@/venues/_shared/api-venue.run";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";

import configJson from "./venue.config.json";

const config = configJson as VenueConfig;

export async function run(env: IngestEnv, ctx: VenueRunContext): Promise<VenueRunResult> {
  return runApiVenue(env, config, ctx, runVisitFresnoApi);
}

export { config };
