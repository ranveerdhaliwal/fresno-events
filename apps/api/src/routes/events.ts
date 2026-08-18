import { Hono } from "hono";

import type {
  CalendarMonthResponse,
  EventSectionsResponse,
  HomepageCurationResponse
} from "@fresno-events/shared";

import type { Env } from "@/env";
import { parseCalendarMonthQuery, resolveCalendarMonth } from "@/lib/event-calendar";
import { resolveEventSections } from "@/lib/event-sections";
import { resolveHomepageCuration, HomepageCurationError } from "@/lib/homepage-curation";
import { getEventFromSupabase, listEventsFromSupabase, SupabaseEventsError } from "@/lib/supabase-events";
import { fail, ok } from "@/lib/responses";
import { logError } from "@/lib/structured-log";

import {
  parseBounds,
  parseFrom,
  parseLimit,
  parseMaxPriority,
  parseOptionalDate,
  parseRequireCoords,
  parseSeriesId
} from "./events.utils";

export const eventsRoute = new Hono<{ Bindings: Env }>()
  .get("/homepage", async (c) => {
    try {
      return ok<HomepageCurationResponse>(c, await resolveHomepageCuration(c.env));
    } catch (error) {
      if (error instanceof HomepageCurationError) {
        return fail(c, error.code, error.message, error.status as 400);
      }
      if (error instanceof SupabaseEventsError) {
        logError("homepage_curation_supabase_failed", error, { status: error.status });
        return fail(c, "events_unavailable", error.message, error.status === 503 ? 503 : 502);
      }
      // Previously discarded, which left the 502 with no explanation of its cause.
      logError("homepage_curation_failed", error);
      return fail(c, "events_unavailable", "The homepage curation could not be loaded.", 502);
    }
  })
  .get("/sections", async (c) => {
    try {
      return ok<EventSectionsResponse>(c, await resolveEventSections(c.env));
    } catch (error) {
      if (error instanceof SupabaseEventsError) {
        return fail(c, "events_unavailable", error.message, error.status === 503 ? 503 : 502);
      }
      return fail(c, "events_unavailable", "Event sections could not be loaded.", 502);
    }
  })
  .get("/calendar", async (c) => {
    const parsed = parseCalendarMonthQuery(c.req.query("year"), c.req.query("month"));
    if (!parsed) {
      return fail(c, "invalid_month", "year and month must be valid integers.", 400);
    }

    try {
      return ok<CalendarMonthResponse>(c, await resolveCalendarMonth(c.env, parsed.year, parsed.month));
    } catch (error) {
      if (error instanceof SupabaseEventsError) {
        return fail(c, "events_unavailable", error.message, error.status === 503 ? 503 : 502);
      }
      return fail(c, "events_unavailable", "Calendar data could not be loaded.", 502);
    }
  })
  .get("/", async (c) => {
    const limit = parseLimit(c.req.query("limit"));
    const from = parseFrom(c.req.query("from"));
    const until = parseOptionalDate(c.req.query("until"));
    const maxPriority = parseMaxPriority(c.req.query("maxPriority"));
    const seriesId = parseSeriesId(c.req.query("series_id"));
    const bounds = parseBounds(c.req.query("bounds"));
    const requireCoords = parseRequireCoords(c.req.query("require_coords"));

    if (!from) {
      return fail(c, "invalid_from", "The from query parameter must be a valid ISO date.", 400);
    }

    if (until === null) {
      return fail(c, "invalid_until", "The until query parameter must be a valid ISO date.", 400);
    }

    if (maxPriority === null) {
      return fail(c, "invalid_max_priority", "maxPriority must be an integer 0–5.", 400);
    }

    if (bounds === null) {
      return fail(c, "invalid_bounds", "bounds must be swLat,swLng,neLat,neLng.", 400);
    }

    try {
      return ok(
        c,
        await listEventsFromSupabase(c.env, {
          from,
          limit,
          ...(until ? { until } : {}),
          ...(maxPriority !== undefined ? { maxPriority } : {}),
          ...(seriesId ? { seriesId } : {}),
          ...(requireCoords ? { requireCoords } : {}),
          ...(bounds ? { bounds } : {})
        })
      );
    } catch (error) {
      if (error instanceof SupabaseEventsError) {
        return fail(c, "events_unavailable", error.message, error.status === 503 ? 503 : 502);
      }

      return fail(c, "events_unavailable", "The event listing could not be loaded.", 502);
    }
  })
  .get("/:slug", async (c) => {
    try {
      const detail = await getEventFromSupabase(c.env, c.req.param("slug"));

      if (!detail) {
        return fail(c, "event_not_found", "That event could not be found.", 404);
      }

      return ok(c, detail);
    } catch (error) {
      if (error instanceof SupabaseEventsError) {
        return fail(c, "event_unavailable", error.message, error.status === 503 ? 503 : 502);
      }

      return fail(c, "event_unavailable", "The event detail could not be loaded.", 502);
    }
  });
