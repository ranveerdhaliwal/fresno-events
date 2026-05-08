export interface IngestEnv {
  APP_ENV?: string;
  USER_AGENT?: string;
  MAX_SOURCES_PER_RUN?: string;
  MAX_ENRICH_PER_RUN?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ADMIN_REVIEW_TOKEN?: string;
  TICKETMASTER_API_KEY?: string;
  SEATGEEK_CLIENT_ID?: string;
  SEATGEEK_CLIENT_SECRET?: string;
  EVENTBRITE_API_KEY?: string;
  BANDSINTOWN_APP_ID?: string;
  ANTHROPIC_API_KEY?: string;
  AI?: Ai;
}
