import type { ContentDiffEntry, ContentDiffField, ContentDiffSummary, NormalizedEvent } from "@fresno-events/shared";

const DIFF_FIELD_LABELS: Record<ContentDiffField, string> = {
  title: "Title",
  startTs: "Start time",
  endTs: "End time",
  venueName: "Venue",
  venueCity: "City",
  venueAddress: "Address",
  descriptionText: "Description",
  ticketUrl: "Ticket URL",
  externalUrl: "External URL",
  category: "Category"
};

const DIFF_FIELDS: ContentDiffField[] = [
  "title",
  "startTs",
  "endTs",
  "venueName",
  "venueCity",
  "venueAddress",
  "descriptionText",
  "ticketUrl",
  "externalUrl",
  "category"
];

export interface PublishedDiffSource {
  title: string;
  startTs: string;
  endTs?: string;
  descriptionText?: string;
  ticketUrl?: string;
  externalUrl?: string;
  category: string;
  venueName?: string;
  venueCity?: string;
  venueAddress?: string;
}

function normalize(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function publishedToDiffSlice(source: PublishedDiffSource): Record<ContentDiffField, string | null> {
  return {
    title: normalize(source.title),
    startTs: normalize(source.startTs),
    endTs: normalize(source.endTs),
    venueName: normalize(source.venueName),
    venueCity: normalize(source.venueCity),
    venueAddress: normalize(source.venueAddress),
    descriptionText: normalize(source.descriptionText),
    ticketUrl: normalize(source.ticketUrl),
    externalUrl: normalize(source.externalUrl),
    category: normalize(source.category)
  };
}

export function normalizedToDiffSlice(event: NormalizedEvent): Record<ContentDiffField, string | null> {
  return {
    title: normalize(event.title),
    startTs: normalize(event.startTs),
    endTs: normalize(event.endTs),
    venueName: normalize(event.venueName),
    venueCity: normalize(event.venueCity),
    venueAddress: normalize(event.venueAddress),
    descriptionText: normalize(event.descriptionText),
    ticketUrl: normalize(event.ticketUrl),
    externalUrl: normalize(event.externalUrl),
    category: normalize(event.category)
  };
}

export function buildContentDiff(
  published: PublishedDiffSource,
  proposed: NormalizedEvent
): ContentDiffSummary | null {
  const before = publishedToDiffSlice(published);
  const after = normalizedToDiffSlice(proposed);
  const entries: ContentDiffEntry[] = [];

  for (const field of DIFF_FIELDS) {
    const beforeValue = before[field];
    const afterValue = after[field];
    if (beforeValue !== afterValue) {
      entries.push({
        field,
        label: DIFF_FIELD_LABELS[field],
        before: beforeValue,
        after: afterValue
      });
    }
  }

  if (entries.length === 0) {
    return null;
  }

  return {
    changedFields: entries.map((entry) => entry.field),
    entries
  };
}
