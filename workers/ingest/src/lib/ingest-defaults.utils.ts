import {
  resolveVenueLocationFields,
  sanitizeIngestDescriptionText,
  applyDisplayPriceRounding,
  type NormalizedEvent
} from "@fresno-events/shared";

import { applyKnownVenueLocation } from "@/lib/known-venue-location.utils";

/** Apply cross-source defaults before persisting normalized events. */
export function applyIngestDefaults(event: NormalizedEvent): NormalizedEvent {
  let withVenue = applyKnownVenueLocation(event);
  if (withVenue.venueAddress?.trim()) {
    const { venueAddress, venueCity } = resolveVenueLocationFields(
      withVenue.venueAddress,
      withVenue.venueCity,
      "CA"
    );
    if (venueAddress && venueAddress !== withVenue.venueAddress) {
      withVenue = { ...withVenue, venueAddress };
    }
    if (venueCity && venueCity !== withVenue.venueCity) {
      withVenue = { ...withVenue, venueCity };
    }
  }
  const descriptionText = withVenue.descriptionText?.trim()
    ? sanitizeIngestDescriptionText(withVenue.descriptionText)
    : withVenue.descriptionText;

  const normalized: NormalizedEvent =
    descriptionText !== withVenue.descriptionText
      ? { ...withVenue, ...(descriptionText ? { descriptionText } : {}) }
      : withVenue;

  if (normalized.timeUnknown === true) {
    const { endTs, ...rest } = normalized;
    return endTs ? { ...rest, endTs } : rest;
  }

  if (!normalized.endTs) {
    const { endTs: _omit, ...rest } = normalized;
    return applyDisplayPriceRounding(rest);
  }

  return applyDisplayPriceRounding(normalized);
}
