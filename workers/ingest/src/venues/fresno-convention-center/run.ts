import { createListingDetailVenueRun } from "@/venues/_shared/create-listing-venue-run";
import { discoverConventionCenterDetailUrls } from "@/venues/_shared/link-discover.utils";
import type { VenueConfig } from "@/venues/venue.types";

import configJson from "./venue.config.json";

const config = configJson as VenueConfig;

export const run = createListingDetailVenueRun(config, discoverConventionCenterDetailUrls);
export { config };
