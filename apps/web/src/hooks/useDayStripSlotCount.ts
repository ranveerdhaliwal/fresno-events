import { useEffect, useState, type RefObject } from "react";

const TILE_MIN_WIDTH = 64;
const GAP = 8;
const PICK_DATE_WIDTH = 68;
const MIN_SLOTS = 3;
const MAX_SLOTS = 14;

export interface DayStripSlotCountOptions {
  /** Reserve space for the trailing Pick a Date cell (fill layout). */
  reservePickDate?: boolean;
}

/** How many day tiles fit in the container width. */
export function useDayStripSlotCount(
  viewportRef: RefObject<HTMLElement | null>,
  options: DayStripSlotCountOptions = {}
): number {
  const reservePickDate = options.reservePickDate ?? false;
  const [slotCount, setSlotCount] = useState(7);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const measure = () => {
      const width = element.clientWidth;
      const usable = reservePickDate ? Math.max(0, width - PICK_DATE_WIDTH - GAP) : width;
      const slots = Math.floor((usable + GAP) / (TILE_MIN_WIDTH + GAP));
      setSlotCount(Math.min(MAX_SLOTS, Math.max(MIN_SLOTS, slots)));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewportRef, reservePickDate]);

  return slotCount;
}
