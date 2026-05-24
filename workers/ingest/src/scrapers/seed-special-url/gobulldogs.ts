import type { NormalizedEvent, ScrapeContext } from "@fresno-events/shared";

import type { SeedUrlRow } from "@/seed-urls";

import { buildGobulldogsPrintUrl, parseGobulldogsPrintHtml } from "./gobulldogs.utils";

const FETCH_TIMEOUT_MS = 30_000;

export async function parseGobulldogs(seed: SeedUrlRow, ctx: ScrapeContext): Promise<NormalizedEvent[]> {
  const url = buildGobulldogsPrintUrl(ctx.now);
  const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const signal = ctx.signal ? AbortSignal.any([ctx.signal, timeoutSignal]) : timeoutSignal;

  console.log(JSON.stringify({ event: "seed_special_url", handler: "gobulldogs", step: "fetch_start", url }));

  const response = await fetch(url, {
    headers: { "User-Agent": ctx.userAgent },
    signal
  });

  if (!response.ok) {
    throw new Error(`gobulldogs print fetch HTTP ${response.status} for ${seed.url}`);
  }

  const html = await response.text();
  const events = parseGobulldogsPrintHtml(html, ctx.now);

  if (events.length === 0) {
    console.log(
      JSON.stringify({
        event: "seed_special_url",
        handler: "gobulldogs",
        url: seed.url,
        message:
          "No events parsed from print HTML (page may be client-rendered). Consider lane=crawl for this seed."
      })
    );
  }

  return events;
}
