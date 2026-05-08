import { Hono } from "hono";

import type { Env } from "@/env";
import { fail, ok } from "@/lib/responses";

export const savesRoute = new Hono<{ Bindings: Env }>()
  .get("/", (c) => ok(c, { items: [] }))
  .post("/", (c) => fail(c, "auth_required", "Saving events through the API requires auth wiring.", 401));
