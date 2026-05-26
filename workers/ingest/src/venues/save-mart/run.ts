import type { IngestEnv } from "@/env";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";
import { discoverSaveMartDetailUrls } from "@/venues/_shared/link-discover.utils";
import { runListingThenDetailPipeline } from "@/venues/_shared/listing-detail.run";

import saveMartConfig from "./venue.config.json";

const config = saveMartConfig as VenueConfig;

export async function run(env: IngestEnv, ctx: VenueRunContext): Promise<VenueRunResult> {
  return runListingThenDetailPipeline(env, config, ctx, discoverSaveMartDetailUrls);
}

export { config };
