/** Default event duration when end time is unknown (live detection, day buckets). Not for persistence. */
export const DEFAULT_EVENT_DURATION_MS = 2 * 60 * 60 * 1000;

/** Runtime fallback for scheduling UI — not for storing on candidates or published events. */
export function resolveEndTs(startTs: string, endTs?: string | null): string {
  if (endTs) {
    return endTs;
  }
  const start = new Date(startTs);
  return new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS).toISOString();
}
