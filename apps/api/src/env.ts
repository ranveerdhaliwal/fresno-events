export interface Env {
  APP_ENV?: string;
  ALLOWED_ORIGIN?: string;
  ALLOWED_ORIGINS?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ADMIN_REVIEW_TOKEN?: string;
  /**
   * Google Maps Platform API key — Geocoding, Weather, Air Quality, Pollen, Time Zone,
   * Geolocation, Address Validation, etc. Server-side only. Falls back to Nominatim for geocode when unset.
   */
  GOOGLE_MAPS_PLATFORM_API_KEY?: string;
  /** Base URL for ingest worker maintenance triggers (local default http://127.0.0.1:8788). */
  INGEST_URL?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_IMAGES_TOKEN?: string;
  SENTRY_DSN?: string;
}
