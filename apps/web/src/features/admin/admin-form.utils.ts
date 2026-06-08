import { isValidCoordinate, type NormalizedEvent } from "@fresno-events/shared";

import type { AdminEventFormState } from "./admin-form.types";
import {
  getPacificDateTimeParts,
  instantFromPacificLocal,
  isAllDayPacificStart,
  pacificEndOfDayInstant
} from "@/lib/pacific-time";

const PACIFIC_TZ = "America/Los_Angeles";

export function normalizedEventToFormState(
  event: NormalizedEvent,
  priority: number
): AdminEventFormState {
  const startParts = decodeInstantToFormFields(event.startTs);
  const endParts = event.endTs ? decodeInstantToFormFields(event.endTs, { isEnd: true }) : { date: "", time: "" };

  return {
    title: event.title,
    descriptionText: event.descriptionText ?? "",
    category: event.category ?? "community",
    startDate: startParts.date,
    startTime: startParts.time,
    endDate: endParts.date,
    endTime: endParts.time,
    venueName: event.venueName,
    venueCity: event.venueCity ?? "",
    venueAddress: event.venueAddress ?? "",
    venueLat: formatCoord(event.venueLat),
    venueLng: formatCoord(event.venueLng),
    imageUrl: event.imageUrl ?? "",
    ticketUrl: event.ticketUrl ?? "",
    externalUrl: event.externalUrl ?? "",
    priceMin: event.priceMin?.toString() ?? "",
    priceMax: event.priceMax?.toString() ?? "",
    priceNotes: event.priceNotes ?? "",
    priority
  };
}

function decodeInstantToFormFields(
  iso: string,
  opts?: { isEnd?: boolean }
): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: "", time: "" };
  }

  const pacific = getPacificDateTimeParts(d);
  const allDay = isAllDayPacificStart(iso);

  if (allDay && !opts?.isEnd) {
    return { date: pacific.date, time: "" };
  }

  if (opts?.isEnd && allDay) {
    const endOfDay = pacific.hour === 23 && pacific.minute >= 59;
    if (endOfDay) {
      return { date: pacific.date, time: "" };
    }
  }

  return { date: pacific.date, time: pacific.time };
}

export function formStateToEventPatch(
  original: NormalizedEvent,
  draft: AdminEventFormState
): Partial<NormalizedEvent> {
  const patch: Partial<NormalizedEvent> = {};

  setIfDifferent(patch, "title", draft.title.trim() || original.title, original.title);
  setIfDifferent(patch, "category", draft.category, original.category);
  setIfDifferent(patch, "venueName", draft.venueName.trim() || original.venueName, original.venueName);

  assignOptional(patch, "descriptionText", draft.descriptionText, original.descriptionText);
  assignOptional(patch, "venueCity", draft.venueCity, original.venueCity);
  assignOptional(patch, "venueAddress", draft.venueAddress, original.venueAddress);
  assignCoordOptional(patch, "venueLat", draft.venueLat, original.venueLat);
  assignCoordOptional(patch, "venueLng", draft.venueLng, original.venueLng);
  assignOptional(patch, "imageUrl", draft.imageUrl, original.imageUrl);
  assignOptional(patch, "ticketUrl", draft.ticketUrl, original.ticketUrl);
  assignOptional(patch, "externalUrl", draft.externalUrl, original.externalUrl);

  assignNumberOptional(patch, "priceMin", draft.priceMin, original.priceMin);
  assignNumberOptional(patch, "priceMax", draft.priceMax, original.priceMax);
  assignOptional(patch, "priceNotes", draft.priceNotes, original.priceNotes);

  const startTs = encodeStartInstant(draft);
  if (startTs && startTs !== original.startTs) {
    patch.startTs = startTs;
    patch.timezone = PACIFIC_TZ;
  }

  const endTs = encodeEndInstant(draft);
  const originalEnd = original.endTs ?? undefined;
  if (endTs !== originalEnd) {
    if (endTs) {
      patch.endTs = endTs;
      patch.timezone = PACIFIC_TZ;
    }
  }

  return patch;
}

function encodeStartInstant(draft: AdminEventFormState): string | null {
  const date = draft.startDate.trim();
  if (!date) {
    return null;
  }
  if (!draft.startTime.trim()) {
    // All-day events use noon UTC sentinel (matches ingest scrapers).
    return new Date(`${date}T12:00:00Z`).toISOString();
  }
  return instantFromPacificLocal(date, draft.startTime.trim());
}

function encodeEndInstant(draft: AdminEventFormState): string | undefined {
  const endDate = draft.endDate.trim();
  if (!endDate) {
    return undefined;
  }
  const endTime = draft.endTime.trim();
  if (!endTime) {
    return pacificEndOfDayInstant(endDate) ?? undefined;
  }
  return instantFromPacificLocal(endDate, endTime) ?? undefined;
}

function setIfDifferent<K extends keyof NormalizedEvent>(
  patch: Partial<NormalizedEvent>,
  key: K,
  value: NormalizedEvent[K],
  original: NormalizedEvent[K]
) {
  if (value !== original) {
    patch[key] = value;
  }
}

function assignOptional<K extends keyof NormalizedEvent>(
  patch: Partial<NormalizedEvent>,
  key: K,
  value: string,
  original: NormalizedEvent[K] | undefined
) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return;
  }
  if (trimmed !== (original ?? "")) {
    patch[key] = trimmed as NormalizedEvent[K];
  }
}

function formatCoord(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "";
  }
  return value.toFixed(5);
}

function parseCoord(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!isValidCoordinate(parsed)) {
    return undefined;
  }
  return parsed;
}

function assignCoordOptional(
  patch: Partial<NormalizedEvent>,
  key: "venueLat" | "venueLng",
  value: string,
  original: number | undefined
) {
  const parsed = parseCoord(value);
  if (parsed === undefined) {
    return;
  }
  if (parsed !== original) {
    patch[key] = parsed;
  }
}

function assignNumberOptional<K extends keyof NormalizedEvent>(
  patch: Partial<NormalizedEvent>,
  key: K,
  value: string,
  original: NormalizedEvent[K] | undefined
) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return;
  }
  if (parsed !== original) {
    patch[key] = parsed as NormalizedEvent[K];
  }
}
