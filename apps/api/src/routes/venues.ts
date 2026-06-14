import { Hono } from "hono";

import type { VenueDetailResponse } from "@fresno-events/shared";

import type { Env } from "@/env";
import { fail, ok } from "@/lib/responses";
import { getVenueFromSupabase, SupabaseEventsError } from "@/lib/supabase-events";

export const venuesRoute = new Hono<{ Bindings: Env }>()
  .get("/", (c) => ok(c, { items: [], nextCursor: null }))
  .get("/:slug", async (c) => {
    const slug = c.req.param("slug");

    try {
      const detail = await getVenueFromSupabase(c.env, slug);
      if (!detail) {
        return fail(c, "venue_not_found", `Venue ${slug} was not found.`, 404);
      }
      return ok<VenueDetailResponse>(c, detail);
    } catch (error) {
      if (error instanceof SupabaseEventsError) {
        return fail(c, "venue_unavailable", error.message, error.status === 503 ? 503 : 502);
      }
      return fail(c, "venue_unavailable", "Venue detail could not be loaded.", 502);
    }
  });
