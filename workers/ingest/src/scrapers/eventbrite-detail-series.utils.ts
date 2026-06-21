import type { NormalizedEvent } from "@fresno-events/shared";

import {
  mergeEventbriteDetail,
  shouldReplaceEventbriteDescription,
  type EventbriteDetailFields
} from "@/scrapers/eventbrite-detail.utils";

export type EventbriteSeriesPropagationMode = "full" | "suffix";

export interface EventbriteSeriesDescriptionSplit {
  mode: EventbriteSeriesPropagationMode;
  suffix: string;
}

const PERFORMANCE_CAST_PREFIX = /^At this performance/i;
const CAST_LINE = /^.+ - .+$/;
const CAST_HEADER = /^\(in order of appearance\)$/i;

export function rowSeriesId(event: NormalizedEvent): string | null {
  const seriesId = event.seriesId?.trim();
  return seriesId || null;
}

/** Split a fetched EB description into full-copy vs suffix-only propagation. */
export function splitEventbriteSeriesDescription(descriptionText: string): EventbriteSeriesDescriptionSplit {
  const trimmed = descriptionText.trim();
  if (!PERFORMANCE_CAST_PREFIX.test(trimmed)) {
    return { mode: "full", suffix: trimmed };
  }

  const lines = trimmed.split("\n");
  let suffixStartLine = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? "";
    if (!line || CAST_HEADER.test(line) || PERFORMANCE_CAST_PREFIX.test(line)) {
      continue;
    }
    if (CAST_LINE.test(line)) {
      continue;
    }
    if (line.length >= 40) {
      suffixStartLine = index;
      break;
    }
  }

  if (suffixStartLine < 0) {
    return { mode: "full", suffix: trimmed };
  }

  const suffix = lines.slice(suffixStartLine).join("\n").trim();
  if (suffix.length < 200) {
    return { mode: "full", suffix: trimmed };
  }

  return { mode: "suffix", suffix };
}

export function mergeEventbriteSeriesSuffix(
  listing: NormalizedEvent,
  suffix: string
): NormalizedEvent {
  const listingPrefix = listing.descriptionText?.trim() ?? "";
  const combined = listingPrefix ? `${listingPrefix}\n\n${suffix}` : suffix;

  if (!shouldReplaceEventbriteDescription(listing.descriptionText, combined)) {
    return listing;
  }

  return {
    ...listing,
    descriptionText: combined
  };
}

export function mergeEventbriteDetailForSeriesRow(
  listing: NormalizedEvent,
  detail: EventbriteDetailFields,
  options: { mode: EventbriteSeriesPropagationMode; isRepresentative: boolean }
): NormalizedEvent {
  if (options.mode === "full" || options.isRepresentative) {
    return mergeEventbriteDetail(listing, detail);
  }

  const { suffix } = splitEventbriteSeriesDescription(detail.descriptionText ?? "");
  return mergeEventbriteSeriesSuffix(listing, suffix);
}

export interface EventbriteFetchUnit {
  key: string;
  kind: "series" | "url";
  url: string;
  seriesId: string | null;
  rows: EventbriteBackfillRowLike[];
  representativeRowId: string;
}

export interface EventbriteBackfillRowLike {
  id: string;
  title: string;
  normalized_event: NormalizedEvent;
  eventbrite_detail_status: string | null;
}

export function pickSeriesRepresentativeRow(rows: EventbriteBackfillRowLike[]): EventbriteBackfillRowLike {
  const fetched = rows.find((row) => row.eventbrite_detail_status === "fetched");
  if (fetched) {
    return fetched;
  }

  return [...rows].sort((left, right) => {
    const leftTs = left.normalized_event.startTs ?? "";
    const rightTs = right.normalized_event.startTs ?? "";
    return leftTs.localeCompare(rightTs);
  })[0]!;
}

export function detailFieldsFromRow(row: EventbriteBackfillRowLike): EventbriteDetailFields | null {
  const descriptionText = row.normalized_event.descriptionText?.trim() ?? "";
  if (descriptionText.length < 100) {
    return null;
  }
  return { descriptionText };
}

export function buildEventbriteFetchUnits(
  rows: EventbriteBackfillRowLike[],
  resolveUrl: (row: EventbriteBackfillRowLike) => string | null,
  seriesMemberCounts: Map<string, number>
): EventbriteFetchUnit[] {
  const assigned = new Set<string>();
  const units: EventbriteFetchUnit[] = [];

  const bySeries = new Map<string, EventbriteBackfillRowLike[]>();
  for (const row of rows) {
    const seriesId = rowSeriesId(row.normalized_event);
    if (!seriesId) {
      continue;
    }
    const bucket = bySeries.get(seriesId) ?? [];
    bucket.push(row);
    bySeries.set(seriesId, bucket);
  }

  for (const [seriesId, bucket] of bySeries) {
    if ((seriesMemberCounts.get(seriesId) ?? bucket.length) < 2) {
      continue;
    }

    const eligible = bucket.filter((row) => resolveUrl(row));
    if (eligible.length === 0) {
      continue;
    }

    const representative = pickSeriesRepresentativeRow(eligible);
    const url = resolveUrl(representative);
    if (!url) {
      continue;
    }

    for (const row of eligible) {
      assigned.add(row.id);
    }

    units.push({
      key: `series:${seriesId}`,
      kind: "series",
      url,
      seriesId,
      rows: eligible,
      representativeRowId: representative.id
    });
  }

  const byUrl = new Map<string, EventbriteBackfillRowLike[]>();
  for (const row of rows) {
    if (assigned.has(row.id)) {
      continue;
    }
    const raw = resolveUrl(row);
    if (!raw) {
      continue;
    }
    const normalized = raw;
    const bucket = byUrl.get(normalized) ?? [];
    bucket.push(row);
    byUrl.set(normalized, bucket);
  }

  for (const [url, bucket] of byUrl) {
    const representative = bucket[0]!;
    units.push({
      key: `url:${url}`,
      kind: "url",
      url,
      seriesId: null,
      rows: bucket,
      representativeRowId: representative.id
    });
  }

  return units;
}
