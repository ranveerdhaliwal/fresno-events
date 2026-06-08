import { Hono } from "hono";

import type { SearchResponse } from "@fresno-events/shared";

import type { Env } from "@/env";
import {
  searchArtistsFromSupabase,
  searchEventsFromSupabase,
  searchVenuesFromSupabase,
  SupabaseEventsError
} from "@/lib/supabase-events";
import { fail, ok } from "@/lib/responses";

function parseSearchLimit(value: string | undefined): number {
  const parsed = Number(value ?? 10);
  if (!Number.isFinite(parsed)) {
    return 10;
  }
  return Math.min(Math.max(Math.trunc(parsed), 1), 25);
}

function parseSearchFrom(value: string | undefined): Date | undefined {
  if (!value) {
    return new Date();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export const searchRoute = new Hono<{ Bindings: Env }>().get("/", async (c) => {
  const query = (c.req.query("q") ?? "").trim();
  if (query.length < 2) {
    return fail(c, "invalid_query", "Search query must be at least 2 characters.", 400);
  }

  const limit = parseSearchLimit(c.req.query("limit"));
  const from = parseSearchFrom(c.req.query("from"));

  try {
    const [events, venues, artists] = await Promise.all([
      searchEventsFromSupabase(c.env, { q: query, limit, ...(from ? { from } : {}) }),
      searchVenuesFromSupabase(c.env, { q: query, limit }),
      searchArtistsFromSupabase(c.env, { q: query, limit })
    ]);

    return ok<SearchResponse>(c, {
      query,
      events,
      venues: venues.map((venue) => ({
        id: venue.id,
        slug: venue.slug,
        name: venue.name,
        city: venue.city
      })),
      artists,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof SupabaseEventsError) {
      return fail(c, "search_unavailable", error.message, error.status === 503 ? 503 : 502);
    }
    return fail(c, "search_unavailable", "Search could not be completed.", 502);
  }
});
