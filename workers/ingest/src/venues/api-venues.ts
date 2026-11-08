/** Venue keys with strategy=api (direct lane). */
export const API_VENUE_KEYS = [
  "fresno-library",
  "fresno-state-arts",
  "fresno-philharmonic",
  "visit-fresno-county",
  "downtown-fresno",
  "milb-grizzlies",
  "save-mart",
  "big-fresno-fair",
  "gobulldogs"
] as const;

export type ApiVenueKey = (typeof API_VENUE_KEYS)[number];
