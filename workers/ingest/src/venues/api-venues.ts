/** Venue keys with strategy=api (direct lane). */
export const API_VENUE_KEYS = [
  "visit-fresno-county",
  "downtown-fresno",
  "milb-grizzlies",
  "save-mart",
  "big-fresno-fair",
  "gobulldogs"
] as const;

export type ApiVenueKey = (typeof API_VENUE_KEYS)[number];
