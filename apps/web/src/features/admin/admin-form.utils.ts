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
  const startParts = decodeInstantToFormFields(event.startTs, { timeUnknown: event.timeUnknown === true });
  const endParts = event.endTs
    ? decodeInstantToFormFields(event.endTs, { isEnd: true, timeUnknown: event.timeUnknown === true })
    : { date: "", time: "" };

  const timeTba = event.timeUnknown === true;
  const allDay = !timeTba && isAllDayPacificStart(event.startTs);

  return {
    title: event.title,
    descriptionText: event.descriptionText ?? "",
    category: event.category ?? "community",
    startDate: startParts.date,
    startTime: startParts.time,
    endDate: endParts.date,
    endTime: endParts.time,
    allDay,
    timeTba,
    venueName: event.venueName,
    venueCity: event.venueCity ?? "",
    venueAddress: event.venueAddress ?? "",
    venueLat: formatCoord(event.venueLat),
    venueLng: formatCoord(event.venueLng),
    imageUrl: event.imageUrl ?? "",
    ticketUrl: event.ticketUrl ?? "",
    externalUrl: event.externalUrl ?? "",
    isFree: event.isFree === true || (event.priceMin === 0 && event.priceMax === 0),
    priceMin: event.priceMin?.toString() ?? "",
    priceMax: event.priceMax?.toString() ?? "",
    priceNotes: event.priceNotes ?? "",
    priority,
    mapPinEmoji: event.mapPinEmoji ?? ""
  };
}

function decodeInstantToFormFields(
  iso: string,
  opts?: { isEnd?: boolean; timeUnknown?: boolean }
): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: "", time: "" };
  }

  const pacific = getPacificDateTimeParts(d);
  if (opts?.timeUnknown && !opts?.isEnd) {
    return { date: pacific.date, time: "" };
  }

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
  setIfDifferent(patch, "category", draft.category, original.category ?? "community");
  setIfDifferent(patch, "venueName", draft.venueName.trim() || original.venueName, original.venueName);

  assignOptional(patch, "descriptionText", draft.descriptionText, original.descriptionText);
  assignOptional(patch, "venueCity", draft.venueCity, original.venueCity);
  assignOptional(patch, "venueAddress", draft.venueAddress, original.venueAddress);
  assignCoordOptional(patch, "venueLat", draft.venueLat, original.venueLat);
  assignCoordOptional(patch, "venueLng", draft.venueLng, original.venueLng);
  assignOptional(patch, "imageUrl", draft.imageUrl, original.imageUrl);
  assignOptional(patch, "ticketUrl", draft.ticketUrl, original.ticketUrl);
  assignOptional(patch, "externalUrl", draft.externalUrl, original.externalUrl);

  const originalIsFree = original.isFree === true || (original.priceMin === 0 && original.priceMax === 0);
  if (draft.isFree !== originalIsFree) {
    if (draft.isFree) {
      patch.isFree = true;
      patch.priceMin = 0;
      patch.priceMax = 0;
    } else {
      patch.isFree = false;
    }
  }

  if (!draft.isFree) {
    assignNumberOptional(patch, "priceMin", draft.priceMin, original.priceMin);
    assignNumberOptional(patch, "priceMax", draft.priceMax, original.priceMax);
  }
  assignOptional(patch, "priceNotes", draft.priceNotes, original.priceNotes);
  const nextPin = draft.mapPinEmoji.trim();
  const prevPin = original.mapPinEmoji ?? "";
  if (nextPin !== prevPin) {
    patch.mapPinEmoji = nextPin.length > 0 ? nextPin : null;
  }

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

  const timeUnknown = draft.startTime.trim() ? false : draft.timeTba;
  if (timeUnknown !== (original.timeUnknown === true)) {
    patch.timeUnknown = timeUnknown;
  }

  return patch;
}

function encodeStartInstant(draft: AdminEventFormState): string | null {
  const date = draft.startDate.trim();
  if (!date) {
    return null;
  }
  if (draft.startTime.trim()) {
    return instantFromPacificLocal(date, draft.startTime.trim());
  }
  // Date-only sentinel — paired with `allDay` or `timeTba` on the normalized event.
  return new Date(`${date}T12:00:00.000Z`).toISOString();
}

export function applyAdminStartTimeChange(
  draft: AdminEventFormState,
  startTime: string
): AdminEventFormState {
  const trimmed = startTime.trim();
  if (trimmed) {
    return { ...draft, startTime: trimmed, allDay: false, timeTba: false };
  }
  return { ...draft, startTime: "" };
}

export function applyAdminAllDayChange(
  draft: AdminEventFormState,
  allDay: boolean
): AdminEventFormState {
  if (!allDay) {
    return { ...draft, allDay: false };
  }
  return { ...draft, allDay: true, timeTba: false, startTime: "" };
}

export function applyAdminTimeTbaChange(
  draft: AdminEventFormState,
  timeTba: boolean
): AdminEventFormState {
  if (!timeTba) {
    return { ...draft, timeTba: false };
  }
  return { ...draft, timeTba: true, allDay: false, startTime: "" };
}

export function applyAdminIsFreeChange(
  draft: AdminEventFormState,
  isFree: boolean
): AdminEventFormState {
  if (!isFree) {
    return { ...draft, isFree: false };
  }
  return { ...draft, isFree: true, priceMin: "", priceMax: "" };
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

export type AdminReviewFormFieldKey =
  | "priority"
  | "title"
  | "category"
  | "mapPinEmoji"
  | "start"
  | "end"
  | "imageUrl"
  | "ticketUrl"
  | "externalUrl"
  | "isFree"
  | "priceMin"
  | "priceMax"
  | "priceNotes"
  | "descriptionText"
  | "venueName"
  | "venueCity"
  | "venueAddress"
  | "venueLocation";

export function changedAdminFormFieldsFromDraft(
  original: NormalizedEvent,
  baseline: AdminEventFormState,
  draft: AdminEventFormState
): Set<AdminReviewFormFieldKey> {
  const changed = new Set<AdminReviewFormFieldKey>();

  if (baseline.priority !== draft.priority) {
    changed.add("priority");
  }

  const patch = formStateToEventPatch(original, draft);
  if (patch.title !== undefined) changed.add("title");
  if (patch.category !== undefined) changed.add("category");
  if (patch.mapPinEmoji !== undefined) changed.add("mapPinEmoji");
  if (patch.startTs !== undefined || patch.timeUnknown !== undefined) changed.add("start");
  if (patch.endTs !== undefined) changed.add("end");
  if (patch.imageUrl !== undefined) changed.add("imageUrl");
  if (patch.ticketUrl !== undefined) changed.add("ticketUrl");
  if (patch.externalUrl !== undefined) changed.add("externalUrl");
  if (patch.isFree !== undefined) changed.add("isFree");
  if (patch.priceMin !== undefined) changed.add("priceMin");
  if (patch.priceMax !== undefined) changed.add("priceMax");
  if (patch.priceNotes !== undefined) changed.add("priceNotes");
  if (patch.descriptionText !== undefined) changed.add("descriptionText");
  if (patch.venueName !== undefined) changed.add("venueName");
  if (patch.venueCity !== undefined) changed.add("venueCity");
  if (patch.venueAddress !== undefined) changed.add("venueAddress");
  if (patch.venueLat !== undefined || patch.venueLng !== undefined) changed.add("venueLocation");

  return changed;
}

export function hasAdminFormEdits(
  original: NormalizedEvent,
  baseline: AdminEventFormState,
  draft: AdminEventFormState
): boolean {
  return changedAdminFormFieldsFromDraft(original, baseline, draft).size > 0;
}
