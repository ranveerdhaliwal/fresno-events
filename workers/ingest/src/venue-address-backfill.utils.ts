import { resolveVenueLocationFields, type NormalizedEvent } from "@fresno-events/shared";

/** Trailing `, City, ST` or `, City, ST ZIP` mailing suffix. */
export const MAILING_LINE_RE = /,\s*[^,]+,\s*[A-Za-z]{2}(?:\s+\d{5}(?:-\d{4})?)?\s*$/;

export function looksLikeMailingLine(address: string | null | undefined): boolean {
  const trimmed = address?.trim();
  return Boolean(trimmed && MAILING_LINE_RE.test(trimmed));
}

export function normalizeStoredVenueEvent(normalized: NormalizedEvent): NormalizedEvent | null {
  const currentAddress = normalized.venueAddress?.trim() ?? "";
  if (!currentAddress) {
    return null;
  }

  const currentCity = normalized.venueCity?.trim() ?? null;
  const { venueAddress, venueCity } = resolveVenueLocationFields(currentAddress, currentCity, "CA");

  if (!venueAddress || venueAddress === currentAddress) {
    if (venueCity && venueCity !== currentCity && !currentCity) {
      return { ...normalized, venueCity };
    }
    return null;
  }

  return {
    ...normalized,
    venueAddress,
    ...(venueCity && venueCity !== currentCity ? { venueCity } : {})
  };
}
