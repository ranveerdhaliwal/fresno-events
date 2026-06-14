import { Hono } from "hono";

import type { LocalContextResponse } from "@fresno-events/shared";

import type { Env } from "@/env";
import { resolveLocalContext } from "@/lib/local-context";
import { ok } from "@/lib/responses";

export const contextRoute = new Hono<{ Bindings: Env }>().get("/local", async (c) => {
  const data: LocalContextResponse = await resolveLocalContext(c.env);
  return ok(c, data);
});
