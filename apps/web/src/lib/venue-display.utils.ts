import { normalizeVenueStreetAddress } from "@fresno-events/shared";

import type { Venue } from "@fresno-events/shared";

/** One-line venue address for display — avoids duplicating city when it is already in the street line. */
export function formatVenueAddressLine(venue: Pick<Venue, "address" | "city">): string {
  const city = venue.city?.trim() ?? "";
  const street = normalizeVenueStreetAddress(venue.address, city)?.trim() ?? venue.address?.trim() ?? "";

  if (street && city && !street.toLowerCase().includes(city.toLowerCase())) {
    return `${street}, ${city}`;
  }

  return street || city;
}
