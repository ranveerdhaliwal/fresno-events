import type { Context } from "hono";

import type { Env } from "@/env";
import { fail } from "@/lib/responses";
import { logError } from "@/lib/structured-log";

export class ReviewRouteError extends Error {
  constructor(
    message: string,
    readonly status = 502
  ) {
    super(message);
    this.name = "ReviewRouteError";
  }
}

export function handleReviewError(
  c: Context<{ Bindings: Env }>,
  error: unknown,
  fallbackMessage: string
) {
  logError("review_route_error", error, {
    path: c.req.path,
    method: c.req.method,
    fallback_message: fallbackMessage
  });

  if (error instanceof ReviewRouteError) {
    const status =
      error.status === 503 ? 503 : error.status === 400 ? 400 : error.status === 404 ? 404 : 502;
    return fail(c, "review_unavailable", error.message, status);
  }

  return fail(c, "review_unavailable", fallbackMessage, 502);
}
