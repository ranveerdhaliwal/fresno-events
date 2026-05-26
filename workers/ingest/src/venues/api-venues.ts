/** Venue keys with strategy=api — used by ingest:preflight-apis / promote-apis. */
export const API_VENUE_KEYS = [
  "visit-fresno-county",
  "downtown-fresno",
  "milb-grizzlies"
] as const;

export type ApiVenueKey = (typeof API_VENUE_KEYS)[number];

export function apiVenueFilterCsv(): string {
  return API_VENUE_KEYS.join(",");
}
