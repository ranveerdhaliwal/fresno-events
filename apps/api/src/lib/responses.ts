import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { ApiFailure, ApiSuccess } from "@fresno-events/shared";

export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  return c.json<ApiSuccess<T>>({ ok: true, data }, status);
}

export function fail(c: Context, code: string, message: string, status: ContentfulStatusCode = 400) {
  return c.json<ApiFailure>({ ok: false, error: { code, message } }, status);
}
