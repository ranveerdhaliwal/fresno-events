interface ListingUrls {
  ticketUrl?: string;
  externalUrl?: string;
}

const PACIFIC_TZ = "America/Los_Angeles";
const BUCKET_MINUTES = 30;

const TITLE_NOISE_PREFIXES = [
  /^live:\s*/i,
  /^sold out\s*[-–—:]\s*/i,
  /^canceled:\s*/i,
  /^cancelled:\s*/i
];

/** Slug → canonical slug for cross-source venue matching. */
const VENUE_ALIASES: Record<string, string> = {
  "chukchansi-park": "save-mart-center",
  "chukchansi-park-at-tipping-point": "save-mart-center",
  "save-mart-center-at-chukchansi-park": "save-mart-center",
  "fresno-convention-entertainment-center": "fresno-convention-center",
  "fcc": "fresno-convention-center"
};

export interface OccurrenceFingerprints {
  occurrenceKey: string;
  urlKey: string | null;
  /** Keys to probe for step A (current ±1 Pacific bucket). */
  occurrenceKeysForLookup: string[];
}

export function normalizeTitle(title: string): string {
  let value = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  for (const pattern of TITLE_NOISE_PREFIXES) {
    value = value.replace(pattern, "");
  }

  return value
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifyVenue(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "venue"
  );
}

export function normalizeVenue(venueName: string): string {
  const slug = slugifyVenue(venueName);
  return VENUE_ALIASES[slug] ?? slug;
}

export function pacificTimeBucketKey(startTs: string): string | null {
  const instant = new Date(startTs);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  const parts = getPacificDateTimeParts(instant);
  const totalMinutes = parts.hour * 60 + parts.minute;
  const rounded = Math.round(totalMinutes / BUCKET_MINUTES) * BUCKET_MINUTES;
  const { date, minutes } = shiftPacificDate(parts.date, rounded);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function adjacentPacificBucketKeys(bucketKey: string): string[] {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(bucketKey);
  if (!match) {
    return [bucketKey];
  }

  const date = match[1]!;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  const keys = new Set<string>();

  for (const delta of [-BUCKET_MINUTES, 0, BUCKET_MINUTES]) {
    const shifted = shiftPacificDate(date, minutes + delta);
    const hour = Math.floor(shifted.minutes / 60);
    const minute = shifted.minutes % 60;
    keys.add(
      `${shifted.date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    );
  }

  return [...keys];
}

export function normalizeListingUrl(url: string | undefined | null): string | null {
  if (!url?.trim()) {
    return null;
  }

  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    const params = parsed.searchParams;
    const kept = new URLSearchParams();
    for (const key of ["eid", "eventId", "event_id"]) {
      const value = params.get(key);
      if (value) {
        kept.set(key, value);
      }
    }
    const query = kept.toString();
    return `${host}${path}${query ? `?${query}` : ""}`;
  } catch {
    return null;
  }
}

export async function sha256Hex(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function computeOccurrenceKey(
  title: string,
  startTs: string,
  venueName: string
): Promise<string | null> {
  const bucket = pacificTimeBucketKey(startTs);
  if (!bucket) {
    return null;
  }

  const normalizedTitle = normalizeTitle(title);
  const normalizedVenue = normalizeVenue(venueName);
  if (!normalizedTitle || !normalizedVenue) {
    return null;
  }

  return sha256Hex(`${normalizedTitle}|${bucket}|${normalizedVenue}`);
}

export async function computeOccurrenceKeyForBucket(
  title: string,
  bucketKey: string,
  venueName: string
): Promise<string | null> {
  const normalizedTitle = normalizeTitle(title);
  const normalizedVenue = normalizeVenue(venueName);
  if (!normalizedTitle || !normalizedVenue) {
    return null;
  }

  return sha256Hex(`${normalizedTitle}|${bucketKey}|${normalizedVenue}`);
}

export async function computeUrlKey(event: ListingUrls): Promise<string | null> {
  const normalized = normalizeListingUrl(event.ticketUrl ?? event.externalUrl ?? null);
  if (!normalized) {
    return null;
  }

  return sha256Hex(normalized);
}

export async function computeOccurrenceFingerprints(
  event: ListingUrls & { title: string; startTs: string; venueName: string }
): Promise<OccurrenceFingerprints> {
  const bucket = pacificTimeBucketKey(event.startTs);
  const lookupBuckets = bucket ? adjacentPacificBucketKeys(bucket) : [];
  const occurrenceKeysForLookup: string[] = [];

  for (const bucketKey of lookupBuckets) {
    const key = await computeOccurrenceKeyForBucket(event.title, bucketKey, event.venueName);
    if (key) {
      occurrenceKeysForLookup.push(key);
    }
  }

  const occurrenceKey =
    (bucket ? await computeOccurrenceKey(event.title, event.startTs, event.venueName) : null) ??
    occurrenceKeysForLookup[0] ??
    null;

  const urlKey = await computeUrlKey(event);

  return {
    occurrenceKey: occurrenceKey ?? "",
    urlKey,
    occurrenceKeysForLookup: [...new Set(occurrenceKeysForLookup)]
  };
}

/** Lower rank = preferred primary source. */
export function sourcePriorityRank(source: string): number {
  if (source.startsWith("scrape:")) {
    return 0;
  }
  if (source === "api:milb") {
    return 1;
  }
  if (source === "api:visitfresnocounty") {
    return 2;
  }
  if (source === "api:downtownfresno") {
    return 3;
  }
  return 10;
}

function getPacificDateTimeParts(instant: Date): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute"))
  };
}

function shiftPacificDate(dateYmd: string, totalMinutes: number): { date: string; minutes: number } {
  let minutes = totalMinutes;
  let date = dateYmd;

  while (minutes < 0) {
    minutes += 24 * 60;
    date = addDaysToYmd(date, -1);
  }

  while (minutes >= 24 * 60) {
    minutes -= 24 * 60;
    date = addDaysToYmd(date, 1);
  }

  return { date, minutes };
}

function addDaysToYmd(dateYmd: string, deltaDays: number): string {
  const [y, m, d] = dateYmd.split("-").map(Number);
  const utc = Date.UTC(y!, m! - 1, d! + deltaDays);
  const probe = new Date(utc);
  const parts = getPacificDateTimeParts(probe);
  return parts.date;
}
