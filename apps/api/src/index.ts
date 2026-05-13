import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import type { Env } from "@/env";
import { ok } from "@/lib/responses";
import { artistsRoute } from "@/routes/artists";
import { eventsRoute } from "@/routes/events";
import { imagesRoute } from "@/routes/images";
import { ogRoute } from "@/routes/og";
import { reviewRoute } from "@/routes/review";
import { savesRoute } from "@/routes/saves";
import { searchRoute } from "@/routes/search";
import { venuesRoute } from "@/routes/venues";

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin, c) => resolveAllowedOrigin(origin, c.env),
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "x-admin-token"],
    credentials: true
  })
);

function resolveAllowedOrigin(origin: string, env: Env): string | null {
  // ALLOWED_ORIGINS (plural, comma-separated) wins when set; lets prod allow
  // both the public site and a localhost dev UI without dropping CORS.
  const list = env.ALLOWED_ORIGINS;
  if (list) {
    const allowed = list.split(",").map((value) => value.trim()).filter(Boolean);
    return allowed.includes(origin) ? origin : null;
  }
  if (env.ALLOWED_ORIGIN) {
    return env.ALLOWED_ORIGIN === origin ? origin : null;
  }
  // No env configured: echo the request origin (dev-friendly default).
  return origin;
}

app.get("/health", (c) =>
  ok(c, {
    service: "fresno-events-api",
    environment: c.env.APP_ENV ?? "unknown",
    time: new Date().toISOString()
  })
);

app.route("/events", eventsRoute);
app.route("/venues", venuesRoute);
app.route("/artists", artistsRoute);
app.route("/search", searchRoute);
app.route("/saves", savesRoute);
app.route("/og", ogRoute);
app.route("/review", reviewRoute);
app.route("/images", imagesRoute);

app.notFound((c) => c.json({ ok: false, error: { code: "not_found", message: "Route not found." } }, 404));

export default app;
