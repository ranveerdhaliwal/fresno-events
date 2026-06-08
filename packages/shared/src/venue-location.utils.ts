export interface VenueLocationParts {
  street: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface MapsLinkInput {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface ResolvedVenueLocation {
  venueAddress: string | null;
  venueCity: string | null;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MAILING_TAIL_RE = /,\s*([^,]+),\s*([A-Za-z]{2})(?:\s+(\d{5}(?:-\d{4})?))?\s*$/i;
const STATE_ZIP_TAIL_RE = /,\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/i;

/**
 * Parse trailing `, City, ST ZIP` segments (iteratively) from a mailing-style line.
 * Handles duplicated suffixes like `123 Main, Fresno, CA 93726, Fresno, CA 93726`.
 */
export function parseMailingAddress(fullAddress: string): VenueLocationParts | null {
  let street = fullAddress.trim();
  if (!street) {
    return null;
  }

  let city: string | undefined;
  let state: string | undefined;
  let zip: string | undefined;

  for (let pass = 0; pass < 3; pass += 1) {
    const mailingTail = MAILING_TAIL_RE.exec(street);
    if (mailingTail?.index && mailingTail.index > 0) {
      city = mailingTail[1]?.trim();
      state = mailingTail[2]?.toUpperCase();
      zip = mailingTail[3]?.trim();
      street = street.slice(0, mailingTail.index).trim();
      continue;
    }

    const stateZipTail = STATE_ZIP_TAIL_RE.exec(street);
    if (stateZipTail?.index && stateZipTail.index > 0) {
      state = stateZipTail[1]?.toUpperCase();
      zip = stateZipTail[2]?.trim();
      street = street.slice(0, stateZipTail.index).trim();
      continue;
    }

    break;
  }

  if (!street) {
    return null;
  }

  return {
    street,
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(zip ? { zip } : {})
  };
}

/** Pull a street line out of a full mailing-style address when city/state/zip are known separately. */
export function parseStreetFromFullAddress(
  fullAddress: string,
  opts: { city?: string; state?: string; zip?: string } = {}
): string {
  const trimmed = fullAddress.trim();
  if (!trimmed) {
    return trimmed;
  }

  const city = opts.city?.trim();
  if (city) {
    const state = opts.state?.trim() ?? "[A-Z]{2}";
    const zip = opts.zip?.trim() ?? "\\d{5}(?:-\\d{4})?";
    const suffix = new RegExp(
      `,\\s*${escapeRegex(city)}(?:,\\s*${opts.state ? escapeRegex(opts.state) : state})?(?:\\s+${opts.zip ? escapeRegex(opts.zip) : zip})?$`,
      "i"
    );
    const match = suffix.exec(trimmed);
    if (match?.index !== undefined && match.index > 0) {
      return trimmed.slice(0, match.index).trim();
    }
  }

  const mailing = parseMailingAddress(trimmed);
  if (mailing?.street && mailing.street !== trimmed) {
    return mailing.street;
  }

  return trimmed;
}

export function normalizeVenueStreetAddress(
  address: string | null | undefined,
  city?: string | null,
  state?: string | null
): string | null {
  const trimmed = address?.trim();
  if (!trimmed) {
    return null;
  }

  const street = parseStreetFromFullAddress(
    trimmed,
    city || state ? { ...(city ? { city } : {}), ...(state ? { state } : {}) } : {}
  );
  return street || null;
}

/** Split a mailing line into street + city; prefers explicit city, then parsed city from the line. */
export function resolveVenueLocationFields(
  address: string | null | undefined,
  city?: string | null,
  state?: string | null
): ResolvedVenueLocation {
  const trimmed = address?.trim() ?? "";
  const explicitCity = city?.trim() || null;
  const explicitState = state?.trim() || null;

  if (!trimmed) {
    return { venueAddress: null, venueCity: explicitCity };
  }

  const hintedStreet = normalizeVenueStreetAddress(trimmed, explicitCity, explicitState);
  const mailing = parseMailingAddress(trimmed);
  const street = hintedStreet ?? mailing?.street ?? trimmed;
  const resolvedCity = explicitCity ?? mailing?.city ?? null;

  return {
    venueAddress: street || null,
    venueCity: resolvedCity
  };
}

export function isValidCoordinate(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Prefer coordinates; otherwise a single-line geocoding query for Google Maps. */
export function buildMapsSearchQuery(input: MapsLinkInput): string | null {
  if (isValidCoordinate(input.lat) && isValidCoordinate(input.lng)) {
    return `${input.lat},${input.lng}`;
  }

  const street = normalizeVenueStreetAddress(input.address, input.city, input.state);
  const parts = [street, input.city?.trim(), input.state?.trim(), input.zip?.trim()].filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  return parts.join(", ");
}

export function buildGoogleMapsSearchUrl(input: MapsLinkInput): string | null {
  const query = buildMapsSearchQuery(input);
  if (!query) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
