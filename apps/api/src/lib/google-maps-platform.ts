import type { Env } from "@/env";

/**
 * Shared Google Maps Platform API key (Geocoding, Weather, Air Quality, Pollen,
 * Time Zone, Geolocation, Address Validation, …). Server-side only — never expose to the web app.
 */
export function resolveGoogleMapsPlatformApiKey(env: Env): string | null {
  const key = env.GOOGLE_MAPS_PLATFORM_API_KEY?.trim();
  return key ? key : null;
}
