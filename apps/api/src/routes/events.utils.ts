/** Query parsing for the events listing route — pure helpers for unit tests. */

import { EVENT_PRIORITY_MAX, EVENT_PRIORITY_MIN } from "@fresno-events/shared";

export function parseLimit(value: string | undefined) {
  const parsed = Number(value ?? 12);

  if (!Number.isFinite(parsed)) {
    return 12;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 50);
}

export function parseFrom(value: string | undefined) {
  if (!value) {
    return new Date(Date.now() - 1000 * 60 * 60 * 6);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseOptionalDate(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseMaxPriority(value: string | undefined): number | undefined | null {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < EVENT_PRIORITY_MIN || parsed > EVENT_PRIORITY_MAX) {
    return null;
  }

  return parsed;
}

export function parseSeriesId(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 200) {
    return undefined;
  }

  return trimmed;
}

export interface MapBounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export function parseBounds(value: string | undefined): MapBounds | null | undefined {
  if (!value) {
    return undefined;
  }

  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const swLat = parts[0]!;
  const swLng = parts[1]!;
  const neLat = parts[2]!;
  const neLng = parts[3]!;
  if (swLat > neLat || swLng > neLng) {
    return null;
  }

  return { swLat, swLng, neLat, neLng };
}

export function parseRequireCoords(value: string | undefined): boolean {
  return value === "true" || value === "1";
}
