import { Hono } from "hono";

import type { Env } from "@/env";
import { ok } from "@/lib/responses";

export const searchRoute = new Hono<{ Bindings: Env }>().get("/", (c) =>
  ok(c, {
    query: c.req.query("q") ?? "",
    events: [],
    venues: [],
    artists: []
  })
);
