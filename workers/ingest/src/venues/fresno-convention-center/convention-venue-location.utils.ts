import type { NormalizedEvent } from "@fresno-events/shared";

import { applyKnownVenueLocation, resolveKnownVenueLocation } from "@/lib/known-venue-location.utils";

function isConventionCampusVenue(venueName: string): boolean {
  const key = venueName.toLowerCase().replace(/\s+/g, " ").trim();
  if (!key) {
    return false;
  }
  return (
    /\bsaroyan\b/.test(key) ||
    /\bconvention\s+(?:&\s*)?entertainment\s+center\b/.test(key) ||
    /\bconvention\s+center\b/.test(key)
  );
}

export function resolveConventionVenueLocation(
  venueName: string
): Pick<NormalizedEvent, "venueAddress" | "venueCity" | "venueLat" | "venueLng"> {
  if (!isConventionCampusVenue(venueName)) {
    return {};
  }
  return resolveKnownVenueLocation(venueName);
}

/** Re-apply known campus address + pin after listing/detail merge. */
export function applyConventionVenueLocation(event: NormalizedEvent): NormalizedEvent {
  if (!isConventionCampusVenue(event.venueName)) {
    return event;
  }
  return applyKnownVenueLocation(event);
}
