import type { IngestEnv } from "@/env";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";
import { discoverTowerDetailUrls } from "@/venues/_shared/link-discover.utils";
import { runListingThenDetailPipeline } from "@/venues/_shared/listing-detail.run";

import towerConfig from "./venue.config.json";

const config = towerConfig as VenueConfig;

export async function run(env: IngestEnv, ctx: VenueRunContext): Promise<VenueRunResult> {
  return runListingThenDetailPipeline(env, config, ctx, discoverTowerDetailUrls);
}

export { config };
