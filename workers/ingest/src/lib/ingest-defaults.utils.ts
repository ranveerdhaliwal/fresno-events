import { resolveEndTs, type NormalizedEvent } from "@fresno-events/shared";

import { applyKnownVenueLocation } from "@/lib/known-venue-location.utils";

/** Apply cross-source defaults before persisting normalized events. */
export function applyIngestDefaults(event: NormalizedEvent): NormalizedEvent {
  const withVenue = applyKnownVenueLocation(event);

  if (withVenue.timeUnknown === true) {
    const { endTs, ...rest } = withVenue;
    return endTs ? { ...rest, endTs } : rest;
  }

  return {
    ...withVenue,
    endTs: resolveEndTs(withVenue.startTs, withVenue.endTs)
  };
}
