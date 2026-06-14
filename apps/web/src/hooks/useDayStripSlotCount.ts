import { useEffect, useState, type RefObject } from "react";

const TILE_MIN_WIDTH = 64;
const GAP = 8;
const MIN_SLOTS = 3;
const MAX_SLOTS = 10;

/** How many day tiles fit in the viewport (pick-a-date is outside the viewport). */
export function useDayStripSlotCount(viewportRef: RefObject<HTMLElement | null>): number {
  const [slotCount, setSlotCount] = useState(7);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const measure = () => {
      const width = element.clientWidth;
      const slots = Math.floor((width + GAP) / (TILE_MIN_WIDTH + GAP));
      setSlotCount(Math.min(MAX_SLOTS, Math.max(MIN_SLOTS, slots)));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewportRef]);

  return slotCount;
}
