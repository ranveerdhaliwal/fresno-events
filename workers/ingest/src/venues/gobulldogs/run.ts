import type { IngestEnv } from "@/env";
import { buildGobulldogsPrintUrl, parseGobulldogsPrintHtml } from "@/scrapers/seed-special-url/gobulldogs.utils";
import { runHtmlParseVenue } from "@/venues/_shared/html-parse.run";
import type { VenueConfig, VenueRunContext, VenueRunResult } from "@/venues/venue.types";

import configJson from "./venue.config.json";

const config = configJson as VenueConfig;

export async function run(env: IngestEnv, ctx: VenueRunContext): Promise<VenueRunResult> {
  return runHtmlParseVenue(env, config, ctx, async (_env, _config, runCtx) => {
    const url = buildGobulldogsPrintUrl(runCtx.dryRun ? new Date() : new Date());
    const timeoutSignal = AbortSignal.timeout(30_000);
    const signal = runCtx.signal ? AbortSignal.any([runCtx.signal, timeoutSignal]) : timeoutSignal;
    const response = await fetch(url, {
      headers: { "User-Agent": runCtx.userAgent },
      signal
    });
    if (!response.ok) {
      throw new Error(`gobulldogs print fetch HTTP ${response.status}`);
    }
    const html = await response.text();
    return parseGobulldogsPrintHtml(html, new Date());
  });
}

export { config };
