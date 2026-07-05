export const SWIPE_DAY_THRESHOLD_PX = 48;

/** Returns -1 (previous day), 1 (next day), or 0 when swipe is below threshold. */
export function swipeDayDelta(
  startX: number,
  endX: number,
  threshold = SWIPE_DAY_THRESHOLD_PX
): -1 | 0 | 1 {
  const delta = endX - startX;
  if (Math.abs(delta) < threshold) {
    return 0;
  }
  return delta < 0 ? 1 : -1;
}
