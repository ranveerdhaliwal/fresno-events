import type { ScrapeContext } from "@fresno-events/shared";

import type { IngestEnv } from "@/env";
import type { VenueRunContext } from "@/venues/venue.types";

const VENUE_SECRET_KEYS: ReadonlyArray<keyof IngestEnv> = [
  "VISIT_FRESNO_API_TOKEN",
  "SAVE_MART_EVENTS_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "ANTHROPIC_API_KEY",
  "AI_TEXT_PROVIDER",
  "AI_TEXT_PROVIDER_DISCOVERY",
  "AI_TEXT_PROVIDER_ENRICHMENT"
];

export function buildVenueScrapeContext(env: IngestEnv, ctx: VenueRunContext): ScrapeContext {
  const secrets: Record<string, string | undefined> = {};
  for (const key of VENUE_SECRET_KEYS) {
    const value = env[key];
    if (typeof value === "string") {
      secrets[key as string] = value;
    }
  }

  return {
    runId: ctx.ingestRunId,
    now: new Date(),
    userAgent: ctx.userAgent,
    secrets,
    config: {},
    coordinatorMode: ctx.dryRun ? "dry-run" : "real",
    ...(ctx.signal ? { signal: ctx.signal } : {})
  };
}
