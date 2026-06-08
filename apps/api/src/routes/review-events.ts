import { Hono } from "hono";

import type {
  AdminEventListResponse,
  AdminEventSearchResponse,
  AdminPublishedEventResponse,
  EventBulkPriorityResponse
} from "@fresno-events/shared";

import type { Env } from "@/env";
import { homepageListFrom } from "@/lib/homepage-curation";
import { listPublishedEventsForAdmin, searchEventsFromSupabase } from "@/lib/supabase-events";
import { fail, ok } from "@/lib/responses";
import { requireReviewAuth } from "@/routes/review-auth.utils";
import { handleReviewError } from "@/routes/review.errors";
import {
  getPublishedEventForAdmin,
  patchPublishedEventById
} from "@/routes/review-event-patch.utils";
import { parseOptionalApprovePriority, readJsonBody } from "@/routes/review-mappers.utils";
import { ReviewRouteError } from "@/routes/review.errors";

export const reviewEventsRoute = new Hono<{ Bindings: Env }>();

reviewEventsRoute.use("*", async (c, next) => {
  const authError = await requireReviewAuth(c.env, c.req.header("authorization"), c.req.header("x-admin-token"));
  if (authError) {
    return fail(c, authError.code, authError.message, authError.status);
  }
  await next();
});

function toAdminEventListHit(item: Awaited<ReturnType<typeof listPublishedEventsForAdmin>>["items"][number]) {
  return {
    id: item.event.id,
    slug: item.event.slug,
    title: item.event.title,
    startTs: item.event.startTs,
    venueName: item.venue.name,
    heroImageUrl: item.heroImage?.cdnUrl ?? null,
    priority: item.event.priority,
    source: item.event.source,
    status: item.event.status
  };
}

reviewEventsRoute
  .get("/events", async (c) => {
    const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50) || 50, 1), 100);
    const offset = Math.max(Number(c.req.query("offset") ?? 0) || 0, 0);
    const scopeParam = c.req.query("scope");
    const scope =
      scopeParam === "past" || scopeParam === "all" ? scopeParam : ("future" as const);
    const q = c.req.query("q")?.trim();

    try {
      const result = await listPublishedEventsForAdmin(c.env, {
        limit,
        offset,
        scope,
        ...(q ? { q } : {})
      });

      return ok<AdminEventListResponse>(c, {
        items: result.items.map(toAdminEventListHit),
        total: result.total,
        limit,
        offset
      });
    } catch (error) {
      return handleReviewError(c, error, "Published events could not be listed.");
    }
  })
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
  .post("/events/bulk-priority", async (c) => {
    const body = await readJsonBody(c.req.raw);
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const priority = parseOptionalApprovePriority(body.priority);

    if (ids.length === 0) {
      return fail(c, "invalid_request", "ids must be a non-empty array.", 400);
    }

    if (ids.length > 100) {
      return fail(c, "invalid_request", "At most 100 ids per bulk-priority request.", 400);
    }

    if (priority === undefined) {
      return fail(c, "invalid_request", "priority (0–5) is required.", 400);
    }

    const uniqueIds = [...new Set(ids)];
    const failed: EventBulkPriorityResponse["failed"] = [];
    let updated = 0;

    for (const id of uniqueIds) {
      try {
        await patchPublishedEventById(c.env, id, { priority });
        updated += 1;
      } catch (error) {
        const message =
          error instanceof ReviewRouteError
            ? error.message
            : error instanceof Error
              ? error.message
              : String(error);
        failed.push({ id, message });
      }
    }

    return ok<EventBulkPriorityResponse>(c, { priority, updated, failed });
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
