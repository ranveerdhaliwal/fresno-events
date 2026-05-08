import { Hono } from "hono";

import type { Env } from "@/env";

export const imagesRoute = new Hono<{ Bindings: Env }>();

imagesRoute.get("/*", async (c) => {
  if (!c.env.EVENT_IMAGES) {
    return c.json({ ok: false, error: { code: "image_unavailable", message: "EVENT_IMAGES bucket is not configured." } }, 503);
  }

  const key = c.req.path.replace(/^\/images\//, "");
  if (!key) {
    return c.json({ ok: false, error: { code: "image_not_found", message: "No image key provided." } }, 404);
  }

  const object = await c.env.EVENT_IMAGES.get(key);
  if (!object) {
    return c.json({ ok: false, error: { code: "image_not_found", message: "Image not found." } }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=86400, immutable");

  return new Response(object.body, { headers });
});
