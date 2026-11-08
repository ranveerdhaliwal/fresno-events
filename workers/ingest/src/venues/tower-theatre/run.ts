import type { IngestEnv } from "@/env";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";
import { discoverTowerDetailUrls } from "@/venues/_shared/link-discover.utils";
import { runListingThenDetailPipeline } from "@/venues/_shared/listing-detail.run";

import towerConfig from "./venue.config.json";
import { resolveTowerShowTime } from "./show-time.utils";

const config = towerConfig as VenueConfig;

export async function run(env: IngestEnv, ctx: VenueRunContext): Promise<VenueRunResult> {
  const result = await runListingThenDetailPipeline(env, config, ctx, discoverTowerDetailUrls);
  return { ...result, events: result.events.map(resolveTowerShowTime) };
}

export { config };
