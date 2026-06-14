import type { NormalizedEvent } from "@fresno-events/shared";

import { applyKnownVenueLocation, resolveKnownVenueLocation } from "@/lib/known-venue-location.utils";

function isChaffeeZooVenue(venueName: string): boolean {
  const key = venueName.toLowerCase().replace(/\s+/g, " ").trim();
  return /\bchaffee\b/.test(key) && /\bzoo\b/.test(key);
}

export function resolveChaffeeVenueLocation(
  venueName: string
): Pick<NormalizedEvent, "venueAddress" | "venueCity" | "venueLat" | "venueLng"> {
  if (!isChaffeeZooVenue(venueName)) {
    return {};
  }
  return resolveKnownVenueLocation(venueName);
}

/** Re-apply known zoo address + pin on parsed rows. */
export function applyChaffeeVenueLocation(event: NormalizedEvent): NormalizedEvent {
  if (!isChaffeeZooVenue(event.venueName)) {
    return event;
  }
  return applyKnownVenueLocation(event);
}
