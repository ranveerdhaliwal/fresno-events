import type { NormalizedEvent } from "@fresno-events/shared";
import type { CheerioAPI } from "cheerio";
import { z } from "zod";

import { instantFromPacificLocal } from "@/lib/pacific-instant.utils";
import type { VenueConfig } from "@/venues/venue.types";

const EventSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  slug: z.string(),
  eventDate: z.string(),
  eventTime: z.string().optional(),
  eventFlyer: z.string().optional(),
  ticketUrl: z.string(),
  status: z.string().optional()
});

function findInitialEvents(value: unknown): unknown[] | null {
  if (!value || typeof value !== "object") return null;
  if ("initialEvents" in value && Array.isArray(value.initialEvents)) return value.initialEvents;
  for (const child of Object.values(value)) {
    const found = findInitialEvents(child);
    if (found) return found;
  }
  return null;
}

/** Decode JSON Flight records only; never execute scripts from the source page. */
export function readFlightRecords($: CheerioAPI): unknown[] {
  let payload = "";
  $("script").each((_, element) => {
    const match = $(element)
      .text()
      .match(/^self\.__next_f\.push\((.*)\)\s*;?$/s);
    if (!match) return;
    try {
      const chunk: unknown = JSON.parse(match[1]!);
      if (Array.isArray(chunk) && chunk[0] === 1 && typeof chunk[1] === "string")
        payload += chunk[1];
    } catch {
      /* Other script formats do not contain JSON Flight records. */
    }
  });
  const records: unknown[] = [];
  const bytes = new TextEncoder().encode(payload);
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset < bytes.length) {
    const prefix = decoder.decode(bytes.subarray(offset, offset + 40)).match(/^[a-f\d]*:/i);
    if (!prefix) break;
    offset += prefix[0].length;
    // Flight text records have a UTF-8 byte count, not a newline delimiter.
    // Skipping them by line would swallow the next event record (POSH uses these).
    const textHeader = decoder.decode(bytes.subarray(offset, offset + 30)).match(/^T([a-f\d]+),/i);
    if (textHeader) {
      offset += textHeader[0].length + Number.parseInt(textHeader[1]!, 16);
      continue;
    }
    const newline = bytes.indexOf(10, offset);
    const end = newline === -1 ? bytes.length : newline;
    const line = decoder.decode(bytes.subarray(offset, end));
    offset = end + 1;
    try {
      records.push(JSON.parse(line));
    } catch {
      /* Module and text records are not event data. */
    }
  }
  return records;
}

export function parseRainbowFlightListing(
  $: CheerioAPI,
  config: VenueConfig
): NormalizedEvent[] | null {
  const records = readFlightRecords($)
    .map(findInitialEvents)
    .find((items) => items !== null);
  if (!records) return null;
  const events: NormalizedEvent[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    const parsed = EventSchema.safeParse(record);
    if (!parsed.success) continue;
    const e = parsed.data;
    if (e.status && e.status !== "published") continue;
    if (!e.title.trim()) continue;
    let ticket: URL;
    try {
      ticket = new URL(e.ticketUrl);
    } catch {
      continue;
    }
    if (
      !/^https?:$/.test(ticket.protocol) ||
      !config.allowedExternalHosts?.some(
        (host) => ticket.hostname === host || ticket.hostname.endsWith(`.${host}`)
      )
    )
      continue;
    // Native CMS dates carry offsets; imported Eventmania dates are Pacific wall clocks.
    let startTs: string | null = null;
    if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(e.eventDate)) {
      const date = new Date(e.eventDate);
      if (Number.isFinite(date.getTime())) startTs = date.toISOString();
    } else {
      const local = e.eventDate.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/);
      if (local) startTs = instantFromPacificLocal(local[1]!, local[2]!);
    }
    if (!startTs) continue;
    const eventmaniaId =
      ticket.hostname.replace(/^www\./, "") === "eventmania.com"
        ? ticket.pathname.split("/").filter(Boolean).at(-1)
        : null;
    const sourceEventId = `venue:${config.key}:${eventmaniaId ?? `cms-${e.id}`}`;
    if (seen.has(sourceEventId)) continue;
    seen.add(sourceEventId);
    let imageUrl: string | undefined;
    if (e.eventFlyer) {
      try {
        const image = new URL(e.eventFlyer, config.listingUrl);
        if (/^https?:$/.test(image.protocol)) imageUrl = image.href;
      } catch {
        /* Malformed images should not drop a valid event. */
      }
    }
    events.push({
      source: "scrape:rainbowballroom.com",
      sourceEventId,
      title: e.title.trim(),
      venueName: config.label,
      venueCity: "Fresno",
      venueAddress: "1725 Broadway St, Fresno, CA 93721",
      startTs,
      category: "music",
      externalUrl: new URL(`/events/${encodeURIComponent(e.slug)}`, config.listingUrl).href,
      ticketUrl: ticket.href,
      ...(imageUrl ? { imageUrl } : {})
    });
  }
  return events;
}
