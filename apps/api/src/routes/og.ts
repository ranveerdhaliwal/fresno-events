import { Hono } from "hono";

import type { Env } from "@/env";
import { fail } from "@/lib/responses";

export const ogRoute = new Hono<{ Bindings: Env }>().get("/event/:slug", (c) =>
  fail(c, "not_implemented", `OG image generation for ${c.req.param("slug")} is not implemented yet.`, 501)
);
