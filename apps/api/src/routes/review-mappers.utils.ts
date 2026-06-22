import {
  EVENT_PRIORITY_DEFAULT,
  EVENT_PRIORITY_MAX,
  EVENT_PRIORITY_MIN,
  applyDisplayPriceRounding,
  eventCategories,
  pacificTimeBucketKey,
  resolveVenueLocationFields,
  type EventCandidateStatus,
  type EventCategory,
  type NormalizedEvent
} from "@fresno-events/shared";

import { ReviewRouteError } from "@/routes/review.errors";
import { validCandidateStatuses } from "@/routes/review.constants";

export function mergeNormalizedEvent(current: NormalizedEvent, override: unknown): NormalizedEvent {
  if (!override || typeof override !== "object" || Array.isArray(override)) {
    return current;
  }

  const merged = {
    ...current,
    ...override,
    source: current.source,
    sourceEventId: current.sourceEventId
  } as NormalizedEvent;

  const withVenue = !merged.venueAddress?.trim()
    ? merged
    : (() => {
        const { venueAddress, venueCity } = resolveVenueLocationFields(
          merged.venueAddress,
          merged.venueCity,
          "CA"
        );
        return {
          ...merged,
          ...(venueAddress ? { venueAddress } : {}),
          ...(venueCity ? { venueCity } : {})
        };
      })();

  return applyDisplayPriceRounding(withVenue);
}

export function toCandidateStatus(value: string | undefined | null) {
  return validCandidateStatuses.includes(value as EventCandidateStatus)
    ? (value as EventCandidateStatus)
    : null;
}

export function toEventCategory(value: string | null | undefined): EventCategory {
  return eventCategories.includes(value as EventCategory) ? (value as EventCategory) : "community";
}

export function parseLimit(value: string | undefined) {
  const parsed = Number(value ?? 50);

  if (!Number.isFinite(parsed)) {
    return 50;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 5000);
}

export function parseOffset(value: string | undefined) {
  const parsed = Number(value ?? 0);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.min(Math.trunc(parsed), 5000);
}

/** Parse PostgREST `Content-Range` total (e.g. `0-0/279` → 279). */
export function parseContentRangeTotal(contentRange: string | null): number | null {
  if (!contentRange) {
    return null;
  }
  const match = /\/(\d+)$/.exec(contentRange.trim());
  if (!match?.[1]) {
    return null;
  }
  const total = Number(match[1]);
  return Number.isFinite(total) ? total : null;
}

export function parseApprovePriority(body: Record<string, unknown>): number {
  const raw = body.priority;
  if (raw === undefined) {
    return EVENT_PRIORITY_DEFAULT;
  }

  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < EVENT_PRIORITY_MIN || raw > EVENT_PRIORITY_MAX) {
    throw new ReviewRouteError("priority must be an integer 0–5.", 400);
  }

  return raw;
}

export function parseOptionalApprovePriority(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < EVENT_PRIORITY_MIN || value > EVENT_PRIORITY_MAX) {
    throw new ReviewRouteError("priority must be an integer 0–5.", 400);
  }

  return value;
}

export function buildApproveCandidateOptions(input: {
  eventOverride?: unknown;
  priority?: number | undefined;
  notes?: string | undefined;
  reviewedBy?: string | undefined;
}) {
  const options: {
    eventOverride?: unknown;
    priority?: number;
    notes?: string | undefined;
    reviewedBy?: string | undefined;
  } = {};
  if (input.eventOverride !== undefined) {
    options.eventOverride = input.eventOverride;
  }
  if (input.priority !== undefined) {
    options.priority = input.priority;
  }
  if (input.notes !== undefined) {
    options.notes = input.notes;
  }
  if (input.reviewedBy !== undefined) {
    options.reviewedBy = input.reviewedBy;
  }
  return options;
}

export async function readJsonBody(request: Request) {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function compactRecord(input: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
  );
}

export function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function toStringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(toRecord(value)).flatMap(([key, recordValue]) =>
      typeof recordValue === "string" ? [[key, recordValue]] : []
    )
  );
}

export function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

const DEFAULT_SLUG_MAX_LENGTH = 80;

export function slugify(value: string, maxLength = DEFAULT_SLUG_MAX_LENGTH) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, maxLength) || "event"
  );
}

function truncateSlugMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  if (maxLength <= 3) {
    return value.slice(0, maxLength);
  }

  const head = Math.ceil((maxLength - 1) / 2);
  const tail = maxLength - head - 1;
  return `${value.slice(0, head)}-${value.slice(value.length - tail)}`;
}

/** Pacific show date + time (30-min bucket) for slug suffixes — matches occurrence matching. */
export function occurrenceDateTimeSuffixForSlug(startTs: string): string | null {
  const bucket = pacificTimeBucketKey(startTs);
  if (!bucket) {
    return null;
  }

  const [date, time] = bucket.split("T");
  if (!date || !time) {
    return null;
  }

  return `${date}-${time.replace(":", "")}`;
}

/** Last-resort slug when date-time suffix still collides (e.g. legacy rows). */
export function buildEventSlugDisambiguated(
  title: string,
  startTs: string,
  disambiguator: string,
  maxLength = DEFAULT_SLUG_MAX_LENGTH
): string {
  const token = slugify(disambiguator).slice(0, 8) || disambiguator.replace(/-/g, "").slice(0, 8);
  const reserved = 1 + token.length;
  const base = buildEventSlug(title, startTs, maxLength - reserved);
  return `${base}-${token}`.slice(0, maxLength);
}

/** Event slugs end with Pacific show date-time so same-day multi-show runs stay unique. */
export function buildEventSlug(
  title: string,
  startTs: string,
  maxLength = DEFAULT_SLUG_MAX_LENGTH
): string {
  const dateTimePart = occurrenceDateTimeSuffixForSlug(startTs);
  if (!dateTimePart) {
    return slugify(`${title}-${startTs}`, maxLength);
  }

  const dateSuffix = `-${dateTimePart}`;
  const maxTitleLength = maxLength - dateSuffix.length;
  if (maxTitleLength < 8) {
    return slugify(dateTimePart, maxLength);
  }

  const titleSlug = slugify(title, maxTitleLength * 4);
  const truncatedTitle = truncateSlugMiddle(titleSlug, maxTitleLength);
  return `${truncatedTitle}${dateSuffix}`;
}
