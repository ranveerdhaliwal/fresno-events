import { normalizeVenueStreetAddress, stripVenueCountrySuffix } from "@fresno-events/shared";

import type { Venue } from "@fresno-events/shared";

/** One-line venue address for display — avoids duplicating city when it is already in the street line. */
export function formatVenueAddressLine(venue: Pick<Venue, "address" | "city">): string {
  const city = venue.city?.trim() ?? "";
  const rawAddress = stripVenueCountrySuffix(venue.address?.trim() ?? "");
  const street =
    normalizeVenueStreetAddress(rawAddress || venue.address, city)?.trim() ?? rawAddress;

  if (street && city && !street.toLowerCase().includes(city.toLowerCase())) {
    return stripVenueCountrySuffix(`${street}, ${city}`);
  }

  return stripVenueCountrySuffix(street || city);
}
