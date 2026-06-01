import { Hono } from "hono";

import type { AdminEventSearchResponse, AdminPublishedEventResponse } from "@fresno-events/shared";

import type { Env } from "@/env";
import { homepageListFrom } from "@/lib/homepage-curation";
import { searchEventsFromSupabase } from "@/lib/supabase-events";
import { fail, ok } from "@/lib/responses";
import { requireReviewAuth } from "@/routes/review-auth.utils";
import { handleReviewError } from "@/routes/review.errors";
import {
  getPublishedEventForAdmin,
  patchPublishedEventById
} from "@/routes/review-event-patch.utils";
import { readJsonBody } from "@/routes/review-mappers.utils";

export const reviewEventsRoute = new Hono<{ Bindings: Env }>();

reviewEventsRoute.use("*", async (c, next) => {
  const authError = await requireReviewAuth(c.env, c.req.header("authorization"), c.req.header("x-admin-token"));
  if (authError) {
    return fail(c, authError.code, authError.message, authError.status);
  }
  await next();
});

reviewEventsRoute
  .get("/events/search", async (c) => {
    const q = c.req.query("q")?.trim() ?? "";
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 10) || 10, 1), 25);
    const scope = c.req.query("scope") === "all" ? "all" : "future";

    if (q.length < 2) {
      return ok<AdminEventSearchResponse>(c, { items: [] });
    }

    try {
      const from = scope === "future" ? homepageListFrom() : undefined;
      const items = await searchEventsFromSupabase(c.env, {
        q,
        limit,
        ...(from ? { from } : {})
      });

      return ok<AdminEventSearchResponse>(c, {
        items: items.map((item) => ({
          id: item.event.id,
          slug: item.event.slug,
          title: item.event.title,
          startTs: item.event.startTs,
          venueName: item.venue.name,
          heroImageUrl: item.heroImage?.cdnUrl ?? null
        }))
      });
    } catch (error) {
      return handleReviewError(c, error, "Published events could not be searched.");
    }
  })
  .get("/events/:id", async (c) => {
    try {
      const detail = await getPublishedEventForAdmin(c.env, c.req.param("id"));
      if (!detail) {
        return fail(c, "event_not_found", "That published event could not be found.", 404);
      }
      return ok<AdminPublishedEventResponse>(c, detail);
    } catch (error) {
      return handleReviewError(c, error, "Published event could not be loaded.");
    }
  })
  .patch("/events/:id", async (c) => {
    const body = await readJsonBody(c.req.raw);

    try {
      const patchOptions: { eventOverride?: unknown; priority?: number } = {
        eventOverride: body.event
      };
      if (typeof body.priority === "number") {
        patchOptions.priority = body.priority;
      }
      const event = await patchPublishedEventById(c.env, c.req.param("id"), patchOptions);
      return ok(c, { event });
    } catch (error) {
      return handleReviewError(c, error, "Published event could not be updated.");
    }
  });
