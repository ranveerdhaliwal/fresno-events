import type { IngestEnv } from "@/env";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";

import type { DiscoverDetailUrlsFn } from "./listing-detail.run";
import { runListingThenDetailPipeline } from "./listing-detail.run";

export function createListingDetailVenueRun(
  config: VenueConfig,
  discoverDetailUrls: DiscoverDetailUrlsFn
): (env: IngestEnv, ctx: VenueRunContext) => Promise<VenueRunResult> {
  return (env, ctx) => runListingThenDetailPipeline(env, config, ctx, discoverDetailUrls);
}
