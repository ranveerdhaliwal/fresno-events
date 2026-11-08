import type { ScraperRun } from "@fresno-events/shared";
import type { IngestEnv } from "@/env";
import { runApiVenue } from "@/venues/_shared/api-venue.run";
import type { VenueConfig, VenueRunContext } from "@/venues/venue.types";
import { parseCampusEvent, type CampusEvent } from "./arts-events.utils";
import configJson from "./venue.config.json";

export const config = configJson as VenueConfig;
const API = "https://api.calendar.moderncampus.net/pubcalendar/e7caae3d-4f22-4d3b-a99b-14da5397b2f1/events";
const CATEGORIES = ["df966e20-66a9-4af6-b43c-381d2d930905", "7b1420f1-5524-4478-bd91-9be9adea70a3"];

export const scrape: ScraperRun = async ctx => {
  const started = performance.now();
  const fetchUrls: string[] = [];
  const events = new Map<string, NonNullable<ReturnType<typeof parseCampusEvent>>>();
  const errors: { source: string; message: string; recoverable: boolean }[] = [];
  for (let window = 0; window < 2; window += 1) {
    const url = new URL(API);
    url.searchParams.set("start", new Date(ctx.now.getTime() + window * 30 * 86_400_000).toISOString().slice(0, 10));
    url.searchParams.set("end", new Date(ctx.now.getTime() + (window + 1) * 30 * 86_400_000).toISOString().slice(0, 10));
    for (const category of CATEGORIES) url.searchParams.append("category", category);
    try {
      fetchUrls.push(url.href);
      const response = await fetch(url, { headers: { "User-Agent": ctx.userAgent }, signal: ctx.signal ?? null });
      if (!response.ok) throw new Error(`Campus calendar HTTP ${response.status}`);
      const rows = await response.json() as CampusEvent[];
      if (!Array.isArray(rows)) throw new Error("Unexpected campus calendar response");
      for (const row of rows) {
        if (!row.startDatetime || row.status !== "CONFIRMED") continue;
        const detailUrl = `${API}/${encodeURIComponent(row.id)}${row.instanceId ? `/instances/${encodeURIComponent(row.instanceId)}` : ""}`;
        fetchUrls.push(detailUrl);
        const detailResponse = await fetch(detailUrl, { headers: { "User-Agent": ctx.userAgent }, signal: ctx.signal ?? null });
        if (!detailResponse.ok) {
          errors.push({ source: config.key, message: `Campus event ${row.id} HTTP ${detailResponse.status}`, recoverable: true });
          continue;
        }
        const detail = await detailResponse.json() as CampusEvent;
        const event = parseCampusEvent({ ...row, ...detail, ...(row.instanceId ? { instanceId: row.instanceId } : {}) }, ctx.now);
        if (event) events.set(event.sourceEventId!, event);
      }
    } catch (error) {
      if (ctx.signal?.aborted) throw error;
      errors.push({ source: config.key, message: error instanceof Error ? error.message : String(error), recoverable: true });
    }
  }
  return { source: config.key, runId: ctx.runId, events: [...events.values()], errors, metrics: { pagesVisited: fetchUrls.length, fetchUrls, durationMs: Math.round(performance.now() - started) } };
};

export const run = (env: IngestEnv, ctx: VenueRunContext) => runApiVenue(env, config, ctx, scrape);
