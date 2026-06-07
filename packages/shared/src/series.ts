import { normalizeTitle, normalizeVenue, normalizeListingUrl, sha256Hex } from "./occurrence.js";

const RECURRENCE_PATTERN =
  /\b(recurring|weekly|biweekly|monthly|every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|week|month|day))/i;

export function isRecurringSeries(event: { seriesName?: string }): boolean {
  if (!event.seriesName?.trim()) {
    return false;
  }
  return RECURRENCE_PATTERN.test(event.seriesName);
}

export function venueScope(source: string, venueName: string): string {
  const stripped = source.replace(/^(api|scrape):/, "").replace(/^www\./, "");
  return stripped || normalizeVenue(venueName);
}

/** Exported for tests/future use; v1 auto-assign uses title+venue anchor only. */
export function listingUrlSeriesAnchor(url: string | undefined): string | null {
  const normalized = normalizeListingUrl(url ?? null);
  if (!normalized) {
    return null;
  }
  return normalized.replace(/\/\d+\/?$/, "/");
}

function titleAnchor(title: string, venueName: string): string {
  const looseTitle = normalizeTitle(title).replace(/\s+/g, "");
  return `title|${looseTitle}|${normalizeVenue(venueName)}`;
}

export interface SeriesResolveInput {
  source: string;
  title: string;
  venueName: string;
  seriesId?: string;
  seriesName?: string;
  seriesListingRecId?: string;
  /** Assign series from CMS listing id when multiple nights share recid. */
  groupByListingRecId?: boolean;
  /** Assign series when multiple performances share title at the same venue (e.g. Monster Jam). */
  groupByTitleRun?: boolean;
  ticketUrl?: string;
  externalUrl?: string;
}

export interface SeriesResolveResult {
  seriesId: string | undefined;
}

export async function computeCanonicalSeriesId(input: SeriesResolveInput): Promise<SeriesResolveResult> {
  if (input.seriesId) {
    return { seriesId: input.seriesId };
  }

  const scope = venueScope(input.source, input.venueName);

  if (input.groupByListingRecId && input.seriesListingRecId?.trim()) {
    const payload = `series|${scope}|listing|${input.seriesListingRecId.trim()}`;
    const hash = await sha256Hex(payload);
    return { seriesId: `series:${scope}:${hash}` };
  }

  if (input.groupByTitleRun) {
    const anchor = titleAnchor(input.title, input.venueName);
    const payload = `series|${scope}|${anchor}`;
    const hash = await sha256Hex(payload);
    return { seriesId: `series:${scope}:${hash}` };
  }

  if (!isRecurringSeries(input)) {
    return { seriesId: undefined };
  }

  const anchor = titleAnchor(input.title, input.venueName);
  const payload = `series|${scope}|${anchor}`;
  const hash = await sha256Hex(payload);
  return { seriesId: `series:${scope}:${hash}` };
}

/** Ad-hoc series id for admin manual links (title + venue anchor, no recurrence label). */
export async function computeAdHocSeriesId(input: {
  source: string;
  title: string;
  venueName: string;
}): Promise<string> {
  const scope = venueScope(input.source, input.venueName);
  const anchor = titleAnchor(input.title, input.venueName);
  const hash = await sha256Hex(`series|${scope}|${anchor}`);
  return `series:${scope}:${hash}`;
}
