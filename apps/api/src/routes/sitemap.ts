import { Hono } from "hono";

import type { Env } from "@/env";
import { listSitemapEntries, SupabaseEventsError } from "@/lib/supabase-events";

export const sitemapRoute = new Hono<{ Bindings: Env }>().get("/sitemap.xml", async (c) => {
  try {
    const entries = await listSitemapEntries(c.env);
    const body = renderSitemapXml(entries);
    return c.body(body, 200, {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    });
  } catch (error) {
    if (error instanceof SupabaseEventsError) {
      return c.text("Sitemap unavailable.", error.status === 503 ? 503 : 502);
    }
    return c.text("Sitemap unavailable.", 502);
  }
});

function renderSitemapXml(entries: Array<{ loc: string; lastmod: string }>): string {
  const urls = entries
    .map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>\n  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
