import type { NormalizedEvent, ScrapeContext, ScrapeError, ScrapeResult } from "@fresno-events/shared";

const fresnoLocation = "Fresno,CA";

export async function run(ctx: ScrapeContext): Promise<ScrapeResult> {
  const started = performance.now();
  const appId = ctx.secrets.BANDSINTOWN_APP_ID?.trim();
  const artistsCsv = readString(ctx.config.artists);

  if (!appId) {
    return result(ctx, [], [
      {
        source: "bandsintown",
        message: "BANDSINTOWN_APP_ID is not configured.",
        recoverable: true
      }
    ], 0, started);
  }

  if (!artistsCsv) {
    return result(ctx, [], [
      {
        source: "bandsintown",
        message: "Bandsintown source has no `artists` configured (config.artists is a CSV string).",
        recoverable: true
      }
    ], 0, started);
  }

  const artists = artistsCsv.split(",").map((value) => value.trim()).filter(Boolean);
  const events: NormalizedEvent[] = [];
  const errors: ScrapeError[] = [];
  let pagesVisited = 0;

  for (const artist of artists) {
    const url = new URL(`https://rest.bandsintown.com/artists/${encodeURIComponent(artist)}/events`);
    url.searchParams.set("app_id", appId);
    url.searchParams.set("date", "upcoming");

    pagesVisited += 1;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": ctx.userAgent
        },
        ...(ctx.signal ? { signal: ctx.signal } : {})
      });

      if (!response.ok) {
        errors.push({
          source: "bandsintown",
          url: url.toString(),
          message: `Bandsintown responded with ${response.status} for ${artist}.`,
          recoverable: response.status >= 500 || response.status === 429
        });
        continue;
      }

      const payload = await response.json() as BandsintownEvent[];
      for (const event of payload) {
        const normalized = toNormalizedEvent(event, artist);
        if (normalized) {
          events.push(normalized);
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      errors.push({
        source: "bandsintown",
        url: url.toString(),
        message: error instanceof Error ? error.message : `Bandsintown ingest failed for ${artist}.`,
        recoverable: true
      });
    }
  }

  return result(ctx, events, errors, pagesVisited, started);
}

function result(ctx: ScrapeContext, events: NormalizedEvent[], errors: ScrapeError[], pagesVisited: number, started: number): ScrapeResult {
  return {
    source: "bandsintown",
    runId: ctx.runId,
    events,
    errors,
    metrics: { pagesVisited, durationMs: Math.round(performance.now() - started) }
  };
}

function toNormalizedEvent(event: BandsintownEvent, artist: string): NormalizedEvent | null {
  const venueName = event.venue?.name?.trim();
  const cityMatch = matchesFresnoArea(event.venue?.city, event.venue?.region);

  if (!event.id || !event.datetime || !venueName || !cityMatch) {
    return null;
  }

  return {
    source: "bandsintown",
    sourceEventId: String(event.id),
    title: `${artist} at ${venueName}`,
    venueName,
    startTs: ensureZ(event.datetime),
    timezone: "America/Los_Angeles",
    category: "music",
    subcategories: [artist],
    tags: ["bandsintown", "api"],
    currency: "USD",
    ...(event.description ? { descriptionText: event.description } : {}),
    ...(event.venue?.location ? { venueAddress: event.venue.location } : {}),
    ...(event.venue?.city ? { venueCity: event.venue.city } : { venueCity: "Fresno" }),
    ...(event.url ? { externalUrl: event.url, ticketUrl: event.url } : {}),
    ...(event.artist?.image_url ? { imageUrl: event.artist.image_url } : {})
  };
}

function matchesFresnoArea(city: string | undefined, region: string | undefined) {
  if (!city || !region) return false;
  if (region.toUpperCase() !== "CA" && region.toUpperCase() !== "CALIFORNIA") return false;
  const normalized = city.toLowerCase();
  return ["fresno", "clovis", "madera", "kingsburg", "sanger", "selma", "reedley", "visalia", "hanford"].some(
    (match) => normalized.includes(match)
  );
}

function ensureZ(value: string) {
  return value.endsWith("Z") || value.includes("+") ? value : `${value}Z`;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

interface BandsintownEvent {
  id?: string | number;
  url?: string;
  datetime?: string;
  description?: string;
  venue?: {
    name?: string;
    location?: string;
    city?: string;
    region?: string;
  };
  artist?: { image_url?: string };
}

const _hint = fresnoLocation;
void _hint;
