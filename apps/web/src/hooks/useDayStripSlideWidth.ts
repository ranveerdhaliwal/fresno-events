import { useEffect, useState, type RefObject } from "react";

const GAP = 8;

export function useDayStripSlideWidth(
  viewportRef: RefObject<HTMLElement | null>,
  slotCount: number
): number {
  const [slideWidth, setSlideWidth] = useState(72);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || slotCount < 1) {
      return;
    }

    const measure = () => {
      const width = element.clientWidth;
      setSlideWidth((width - (slotCount - 1) * GAP) / slotCount);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewportRef, slotCount]);

  return slideWidth;
}
