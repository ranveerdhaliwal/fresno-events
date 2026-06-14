/** Default event duration when sources omit end time (live detection, day buckets). */
export const DEFAULT_EVENT_DURATION_MS = 2 * 60 * 60 * 1000;

export function resolveEndTs(startTs: string, endTs?: string | null): string {
  if (endTs) {
    return endTs;
  }
  const start = new Date(startTs);
  return new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS).toISOString();
}
