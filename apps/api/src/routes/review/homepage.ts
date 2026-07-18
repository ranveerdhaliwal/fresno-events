import { Hono } from "hono";

import type {
  AdminEventSearchResponse,
  AdminPublishedEventResponse,
  HomepageSlotsPutBody,
  HomepageSlotsResponse
} from "@fresno-events/shared";

import type { Env } from "@/env";
import {
  getHomepageSlotsAdmin,
  HomepageCurationError,
  saveHomepageSlotsAdmin
} from "@/lib/homepage-curation";
import { fail, ok } from "@/lib/responses";
import { requireReviewAuth } from "@/routes/review/auth.utils";
import { handleReviewError } from "@/routes/review/errors";
import { readJsonBody } from "@/routes/review/mappers.utils";

export const reviewHomepageRoute = new Hono<{ Bindings: Env }>();

reviewHomepageRoute.use("*", async (c, next) => {
  const authError = await requireReviewAuth(c.env, c.req.header("authorization"), c.req.header("x-admin-token"));
  if (authError) {
    return fail(c, authError.code, authError.message, authError.status);
  }
  await next();
});

reviewHomepageRoute
  .get("/homepage-slots", async (c) => {
    try {
      return ok<HomepageSlotsResponse>(c, await getHomepageSlotsAdmin(c.env));
    } catch (error) {
      return handleReviewError(c, error, "Homepage slots could not be loaded.");
    }
  })
  .put("/homepage-slots", async (c) => {
    const body = await readJsonBody(c.req.raw);

    try {
      const slots = Array.isArray(body.slots)
        ? body.slots.filter(
            (slot): slot is HomepageSlotsPutBody["slots"][number] =>
              Boolean(slot) &&
              typeof slot === "object" &&
              (slot.section === "featured" || slot.section === "popular") &&
              typeof slot.position === "number" &&
              (slot.eventId === null || typeof slot.eventId === "string")
          )
        : null;

      if (!slots) {
        return fail(c, "invalid_request", "slots must be an array.", 400);
      }

      return ok<HomepageSlotsResponse>(
        c,
        await saveHomepageSlotsAdmin(c.env, {
          slots,
          reviewedBy: typeof body.reviewedBy === "string" ? body.reviewedBy : "admin"
        })
      );
    } catch (error) {
      if (error instanceof HomepageCurationError) {
        return fail(c, error.code, error.message, error.status as 400);
      }
      return handleReviewError(c, error, "Homepage slots could not be saved.");
    }
  });
