import { Hono } from "hono";

import type { Env } from "@/env";
import { fail, ok } from "@/lib/responses";

export const artistsRoute = new Hono<{ Bindings: Env }>()
  .get("/", (c) => ok(c, { items: [], nextCursor: null }))
  .get("/:slug", (c) =>
    fail(c, "not_implemented", `Artist detail for ${c.req.param("slug")} is not implemented yet.`, 501)
  );
