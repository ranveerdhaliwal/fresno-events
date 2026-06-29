import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "@/env";
import { ok } from "@/lib/responses";
import { pacificRequestLogger } from "@/lib/structured-log";
import { artistsRoute } from "@/routes/artists";
import { contextRoute } from "@/routes/context";
import { eventsRoute } from "@/routes/events";
import { reviewRoute } from "@/routes/review";
import { reviewHomepageRoute } from "@/routes/review-homepage";
import { reviewEventsRoute } from "@/routes/review-events";
import { savesRoute } from "@/routes/saves";
import { searchRoute } from "@/routes/search";
import { sitemapRoute } from "@/routes/sitemap";
import { venuesRoute } from "@/routes/venues";

const app = new Hono<{ Bindings: Env }>();

app.use("*", pacificRequestLogger());
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
    return isOriginAllowed(origin, allowed) ? origin : null;
  }
  if (env.ALLOWED_ORIGIN) {
    return isOriginAllowed(origin, [env.ALLOWED_ORIGIN]) ? origin : null;
  }
  // No env configured: echo the request origin (dev-friendly default).
  return origin;
}

/** Allow localhost and 127.0.0.1 on the same port (Vite may use either). */
function isOriginAllowed(origin: string, allowed: string[]): boolean {
  if (allowed.includes(origin)) {
    return true;
  }
  const alternate = localhost127Alternate(origin);
  return alternate !== null && allowed.includes(alternate);
}

function localhost127Alternate(origin: string): string | null {
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost") {
      url.hostname = "127.0.0.1";
      return url.origin;
    }
    if (url.hostname === "127.0.0.1") {
      url.hostname = "localhost";
      return url.origin;
    }
  } catch {
    return null;
  }
  return null;
}

app.get("/health", (c) =>
  ok(c, {
    service: "fresno-events-api",
    environment: c.env.APP_ENV ?? "unknown",
    time: new Date().toISOString()
  })
);

app.route("/events", eventsRoute);
app.route("/context", contextRoute);
app.route("/venues", venuesRoute);
app.route("/artists", artistsRoute);
app.route("/search", searchRoute);
app.route("/saves", savesRoute);
app.route("/", sitemapRoute);
app.route("/review", reviewRoute);
app.route("/review", reviewHomepageRoute);
app.route("/review", reviewEventsRoute);

app.notFound((c) => c.json({ ok: false, error: { code: "not_found", message: "Route not found." } }, 404));

export default app;
