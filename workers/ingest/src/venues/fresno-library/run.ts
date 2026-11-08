import type { ScraperRun } from "@fresno-events/shared";
import type { IngestEnv } from "@/env";
import { runApiVenue } from "@/venues/_shared/api-venue.run";
import type { VenueConfig, VenueRunContext } from "@/venues/venue.types";
import { parseLibraryEvent, type LibraryEvent } from "./library-events.utils";
import branches from "./branches.json";
import configJson from "./venue.config.json";

export const config = configJson as VenueConfig;

export const scrape: ScraperRun = async ctx => {
  const started = performance.now();
  const events = new Map<string, NonNullable<ReturnType<typeof parseLibraryEvent>>>();
  const fetchUrls: string[] = [];
  const errors: { source: string; message: string; recoverable: boolean }[] = [];
  const until = new Date(ctx.now.getTime() + 30 * 86_400_000);
  try {
    for (let page = 1; page <= 10; page += 1) {
      const url = new URL("https://fresnolibrary.libcal.com/ajax/calendar/list");
      url.search = new URLSearchParams({ c: "-1", date: "0000-00-00", perpage: "100", page: String(page), audience: "", cats: "", camps: "", inc: "0" }).toString();
      fetchUrls.push(url.href);
      const response = await fetch(url, { headers: { "User-Agent": ctx.userAgent }, signal: ctx.signal ?? null });
      if (!response.ok) throw new Error(`Library calendar HTTP ${response.status}`);
      const data = await response.json() as { status: number; results: LibraryEvent[]; total_results: number; perpage: number };
      if (data.status !== 1 || !Array.isArray(data.results) || !Number.isFinite(data.total_results)) throw new Error("Unexpected library calendar response");
      for (const row of data.results) {
        const event = parseLibraryEvent(row, branches, ctx.now, until);
        if (event) events.set(event.sourceEventId!, event);
      }
      if (page * data.perpage >= data.total_results) break;
      if (page === 10) throw new Error("Library calendar exceeded the page limit before completing its window");
    }
  } catch (error) {
    if (ctx.signal?.aborted) throw error;
    errors.push({ source: config.key, message: error instanceof Error ? error.message : String(error), recoverable: true });
  }
  return { source: config.key, runId: ctx.runId, events: [...events.values()], errors, metrics: { pagesVisited: fetchUrls.length, fetchUrls, durationMs: Math.round(performance.now() - started) } };
};

export const run = (env: IngestEnv, ctx: VenueRunContext) => runApiVenue(env, config, ctx, scrape);
