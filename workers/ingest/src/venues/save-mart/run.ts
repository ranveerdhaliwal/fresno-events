import type { IngestEnv } from "@/env";
import { run as runSaveMartApi } from "@/scrapers/save-mart-api";
import { runApiVenue } from "@/venues/_shared/api-venue.run";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";

import configJson from "./venue.config.json";

const config = configJson as VenueConfig;

async function runSaveMartWithConfig(env: IngestEnv, ctx: VenueRunContext): Promise<VenueRunResult> {
  return runApiVenue(env, config, ctx, (scrapeCtx) =>
    runSaveMartApi({
      ...scrapeCtx,
      config: { monthWindows: config.monthWindows ?? 6 }
    })
  );
}

export const run = (env: IngestEnv, ctx: VenueRunContext): Promise<VenueRunResult> =>
  runSaveMartWithConfig(env, ctx);

export { config };
