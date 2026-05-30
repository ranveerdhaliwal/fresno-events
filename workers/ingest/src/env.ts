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
  /** Gemini Developer API (AI Studio). Not exposed to the web app. */
  GEMINI_API_KEY?: string;
  /** Alternate env name for the same API key as GEMINI_API_KEY. */
  GOOGLE_API_KEY?: string;
  /** Override default model id for Gemini (e.g. gemini-2.5-flash). */
  GEMINI_MODEL?: string;
  /** Global default: workers_ai | gemini | anthropic */
  AI_TEXT_PROVIDER?: string;
  AI_TEXT_PROVIDER_ENRICHMENT?: string;
  AI_TEXT_PROVIDER_DISCOVERY?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  MAX_PAGES_PER_SEED?: string;
  MAX_CRAWL_DEPTH?: string;
  VISIT_FRESNO_API_TOKEN?: string;
  /** When true, skip scrape validation (logs ingest_validation_skipped). */
  INGEST_SKIP_VALIDATION?: string;
  /** When true or 1, link cross-source duplicates (status/canonical). Keys always computed. */
  INGEST_CROSS_SOURCE_DEDUPE?: string;
  AI?: Ai;
}
