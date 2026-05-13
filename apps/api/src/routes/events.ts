import { Hono } from "hono";

import type { Env } from "@/env";
import { getEventFromSupabase, listEventsFromSupabase, SupabaseEventsError } from "@/lib/supabase-events";
import { fail, ok } from "@/lib/responses";

import { parseFrom, parseLimit, parseOptionalDate } from "./events.utils";

export const eventsRoute = new Hono<{ Bindings: Env }>()
  .get("/", async (c) => {
    const limit = parseLimit(c.req.query("limit"));
    const from = parseFrom(c.req.query("from"));
    const until = parseOptionalDate(c.req.query("until"));

    if (!from) {
      return fail(c, "invalid_from", "The from query parameter must be a valid ISO date.", 400);
    }

    if (until === null) {
      return fail(c, "invalid_until", "The until query parameter must be a valid ISO date.", 400);
    }

    try {
      return ok(c, await listEventsFromSupabase(c.env, { from, limit, ...(until ? { until } : {}) }));
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
