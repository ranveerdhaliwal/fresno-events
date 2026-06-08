import { isValidCoordinate, resolveVenueLocationFields } from "@fresno-events/shared";

import type { Env } from "@/env";
import { resolveGoogleMapsPlatformApiKey } from "@/lib/google-maps-platform";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const USER_AGENT = "WhatUpFresno/1.0 (admin geocode; contact@whatupfresno.com)";

/** Fresno metro bounding box: west, north, east, south */
const VIEWBOX = "-120.6,37.1,-119.3,36.6";

export interface GeocodeInput {
  address: string;
  city?: string;
  state?: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  provider: "google" | "nominatim";
}

export function buildGeocodeQuery(input: GeocodeInput): string | null {
  const resolved = resolveVenueLocationFields(input.address, input.city, input.state);
  const street = resolved.venueAddress?.trim() ?? "";
  const city = resolved.venueCity?.trim() ?? input.city?.trim() ?? "";
  if (!street && !city) {
    return null;
  }
  const parts = [street, city, input.state?.trim() || "CA"].filter(Boolean);
  return parts.join(", ");
}

function parseLatLng(lat: unknown, lng: unknown): GeocodeResult | null {
  const parsedLat = typeof lat === "number" ? lat : Number(lat);
  const parsedLng = typeof lng === "number" ? lng : Number(lng);
  if (!isValidCoordinate(parsedLat) || !isValidCoordinate(parsedLng)) {
    return null;
  }
  return { lat: parsedLat, lng: parsedLng, provider: "google" };
}

async function geocodeWithGoogle(apiKey: string, query: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    address: query,
    key: apiKey,
    region: "us"
  });
  params.set("components", "administrative_area:CA|country:US");

  const response = await fetch(`${GOOGLE_GEOCODE_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Google Geocoding API responded with ${response.status}`);
  }

  const payload = (await response.json()) as {
    status?: string;
    results?: Array<{ geometry?: { location?: { lat?: number; lng?: number } } }>;
    error_message?: string;
  };

  if (payload.status === "ZERO_RESULTS") {
    return null;
  }
  if (payload.status !== "OK") {
    throw new Error(payload.error_message ?? `Google Geocoding status: ${payload.status ?? "unknown"}`);
  }

  const location = payload.results?.[0]?.geometry?.location;
  if (!location) {
    return null;
  }

  const parsed = parseLatLng(location.lat, location.lng);
  return parsed ? { ...parsed, provider: "google" } : null;
}

async function geocodeWithNominatim(query: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    format: "json",
    limit: "1",
    q: query,
    viewbox: VIEWBOX,
    bounded: "1"
  });

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT
    }
  });

  if (!response.ok) {
    throw new Error(`Nominatim responded with ${response.status}`);
  }

  const rows = (await response.json()) as Array<{ lat?: string; lon?: string }>;
  const hit = rows[0];
  if (!hit?.lat || !hit.lon) {
    return null;
  }

  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!isValidCoordinate(lat) || !isValidCoordinate(lng)) {
    return null;
  }

  return { lat, lng, provider: "nominatim" };
}

/** Google Geocoding API when key is set; otherwise free Nominatim (rate-limited). */
export async function geocodeAddress(env: Env, input: GeocodeInput): Promise<GeocodeResult | null> {
  const query = buildGeocodeQuery(input);
  if (!query) {
    return null;
  }

  const googleKey = resolveGoogleMapsPlatformApiKey(env);
  if (googleKey) {
    try {
      const google = await geocodeWithGoogle(googleKey, query);
      if (google) {
        return google;
      }
    } catch {
      // Fall through to Nominatim when Google fails or returns no results.
    }
  }

  return geocodeWithNominatim(query);
}

export function geocodeThrottleMs(env: Env): number {
  return resolveGoogleMapsPlatformApiKey(env) ? 100 : 1100;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
