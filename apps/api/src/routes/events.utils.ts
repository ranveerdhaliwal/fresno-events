/** Query parsing for the events listing route — pure helpers for unit tests. */

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
