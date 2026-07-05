import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DayStripPickDate } from "@/components/DayStrip/DayStripPickDate";
import { DayStripTiles } from "@/components/DayStrip/DayStripTiles";
import { useDayStripSlideWidth } from "@/hooks/useDayStripSlideWidth";
import { useDayStripSlotCount } from "@/hooks/useDayStripSlotCount";
import { buildDayWindowTiles, dayWindowStart, daysBetweenIso } from "@/lib/day-window.utils";
import { addDaysIso } from "@/lib/parse-day-param";
import { cn } from "@/lib/cn";

import { swipeDayDelta } from "./DayDateCarousel.utils";
import styles from "./DayDateCarousel.module.css";

const GAP = 8;

export interface DayDateCarouselProps {
  selectedIso: string;
  onSelectDate: (isoDate: string) => void;
  onRouteSync?: (isoDate: string) => void;
  eventCounts: Map<string, number>;
}

export function DayDateCarousel({
  selectedIso,
  onSelectDate,
  onRouteSync,
  eventCounts
}: DayDateCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const slotCount = useDayStripSlotCount(viewportRef);
  const slideWidth = useDayStripSlideWidth(viewportRef, slotCount);

  const [windowStart, setWindowStart] = useState(() => dayWindowStart(selectedIso, slotCount));
  const [trackTiles, setTrackTiles] = useState<ReturnType<typeof buildDayWindowTiles> | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(false);

  const internalSelectRef = useRef(false);
  const animatingRef = useRef(false);
  const pendingStartRef = useRef<string | null>(null);
  const pendingRouteRef = useRef<string | null>(null);
  const touchStartX = useRef<number | null>(null);

  const restingTiles = useMemo(
    () => buildDayWindowTiles(windowStart, slotCount, eventCounts),
    [windowStart, slotCount, eventCounts]
  );

  const visibleTiles = trackTiles ?? restingTiles;

  useEffect(() => {
    if (internalSelectRef.current) {
      internalSelectRef.current = false;
      return;
    }
    if (animatingRef.current) {
      return;
    }
    setWindowStart(dayWindowStart(selectedIso, slotCount));
    setTrackTiles(null);
    setTranslateX(0);
    setTransitionEnabled(false);
  }, [selectedIso, slotCount]);

  const finishAnimation = useCallback(() => {
    const nextStart = pendingStartRef.current;
    const routeIso = pendingRouteRef.current;
    if (!nextStart) {
      return;
    }

    animatingRef.current = false;
    pendingStartRef.current = null;
    pendingRouteRef.current = null;
    setWindowStart(nextStart);
    setTrackTiles(null);
    setTransitionEnabled(false);
    setTranslateX(0);

    if (routeIso) {
      onRouteSync?.(routeIso);
    }
  }, [onRouteSync]);

  const handleSelect = useCallback(
    (nextIso: string) => {
      if (nextIso === selectedIso || animatingRef.current) {
        return;
      }

      const nextStart = dayWindowStart(nextIso, slotCount);
      const delta = daysBetweenIso(windowStart, nextStart);

      internalSelectRef.current = true;
      onSelectDate(nextIso);

      if (delta === 0 || slideWidth <= 0) {
        onRouteSync?.(nextIso);
        return;
      }

      animatingRef.current = true;
      pendingStartRef.current = nextStart;
      pendingRouteRef.current = nextIso;

      const absDelta = Math.abs(delta);
      const step = slideWidth + GAP;

      if (delta > 0) {
        const extended = buildDayWindowTiles(windowStart, slotCount + absDelta, eventCounts);
        setTrackTiles(extended);
        setTransitionEnabled(false);
        setTranslateX(0);
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            setTransitionEnabled(true);
            setTranslateX(-delta * step);
          });
        });
      } else {
        const extended = buildDayWindowTiles(nextStart, slotCount + absDelta, eventCounts);
        const startOffset = -absDelta * step;
        setTrackTiles(extended);
        setTransitionEnabled(false);
        setTranslateX(startOffset);
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            setTransitionEnabled(true);
            setTranslateX(0);
          });
        });
      }
    },
    [selectedIso, slotCount, windowStart, slideWidth, eventCounts, onSelectDate, onRouteSync]
  );

  const shiftByDays = useCallback(
    (delta: number) => {
      handleSelect(addDaysIso(selectedIso, delta));
    },
    [handleSelect, selectedIso]
  );

  return (
    <div
      className={styles.shell}
      data-testid="day-date-carousel"
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        const end = event.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start == null || end == null) {
          return;
        }
        const dayDelta = swipeDayDelta(start, end);
        if (dayDelta === 0) {
          return;
        }
        shiftByDays(dayDelta);
      }}
    >
      <div className={styles.viewport} ref={viewportRef}>
        <div
          className={cn(styles.track, transitionEnabled && styles.trackAnimated)}
          style={{
            gap: GAP,
            transform: `translate3d(${translateX}px, 0, 0)`
          }}
          onTransitionEnd={(event) => {
            if (event.propertyName !== "transform" || !animatingRef.current) {
              return;
            }
            finishAnimation();
          }}
        >
          <DayStripTiles
            tiles={visibleTiles}
            selectedIso={selectedIso}
            onSelectDate={handleSelect}
            tileWidth={slideWidth}
          />
        </div>
      </div>
      <DayStripPickDate />
    </div>
  );
}
