import type { NormalizedEvent, PublishVenuePreview } from "@fresno-events/shared";
import { normalizeVenueStreetAddress } from "@fresno-events/shared";

import type { Env } from "@/env";
import { slugify } from "@/routes/review-mappers.utils";
import { supabaseReviewRequest } from "@/routes/review-supabase.utils";

export async function fetchVenueCoordsBySlug(
  env: Env,
  slug: string
): Promise<{ lat: number | null; lng: number | null; name: string } | null> {
  const params = new URLSearchParams({
    select: "lat,lng,name",
    slug: `eq.${slug}`,
    limit: "1"
  });
  const rows = await supabaseReviewRequest<Array<{ lat: number | null; lng: number | null; name: string }>>(
    env,
    `/rest/v1/venues?${params}`
  );
  return rows[0] ?? null;
}

export async function fetchVenueCoordsByAddress(
  env: Env,
  address: string,
  city: string
): Promise<{ lat: number; lng: number; name: string } | null> {
  const params = new URLSearchParams({
    select: "lat,lng,name",
    address: `eq.${address}`,
    city: `eq.${city}`,
    lat: "not.is.null",
    limit: "1"
  });
  const rows = await supabaseReviewRequest<Array<{ lat: number | null; lng: number | null; name: string }>>(
    env,
    `/rest/v1/venues?${params}`
  );
  const row = rows[0];
  if (!row || row.lat == null || row.lng == null) {
    return null;
  }
  return { lat: row.lat, lng: row.lng, name: row.name };
}

function hasCandidateCoords(event: NormalizedEvent): boolean {
  const lat = event.venueLat;
  const lng = event.venueLng;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }
  return !(lat === 0 && lng === 0);
}

/** Coordinates the publish path will use when the candidate has none on its own. */
export async function resolvePublishVenuePreview(
  env: Env,
  event: NormalizedEvent
): Promise<PublishVenuePreview | undefined> {
  if (hasCandidateCoords(event)) {
    return undefined;
  }

  const slug = slugify(event.venueName);
  const venue = await fetchVenueCoordsBySlug(env, slug);
  if (venue?.lat != null && venue?.lng != null) {
    return {
      lat: venue.lat,
      lng: venue.lng,
      venueName: venue.name,
      venueSlug: slug,
      source: "existing_venue"
    };
  }

  const address = normalizeVenueStreetAddress(event.venueAddress, event.venueCity);
  const city = event.venueCity?.trim() || "Fresno";
  if (address) {
    const byAddress = await fetchVenueCoordsByAddress(env, address, city);
    if (byAddress) {
      return {
        lat: byAddress.lat,
        lng: byAddress.lng,
        venueName: byAddress.name,
        venueSlug: slug,
        source: "existing_venue"
      };
    }
  }

  return undefined;
}
