import { useMemo, useRef } from "react";
import { pacificTodayIso } from "@fresno-events/shared";

import { DayStrip } from "@/components/DayStrip/DayStrip";
import { useDayStripSlotCount } from "@/hooks/useDayStripSlotCount";
import { buildDayWindowTiles } from "@/lib/day-window.utils";

export interface ForwardDayStripProps {
  selectedIso?: string;
  onSelectDate?: (isoDate: string) => void;
  eventCounts: Map<string, number>;
}

/**
 * Date strip that always starts at Pacific today (leftmost), fills the parent
 * width with as many day tiles as fit, and ends with Pick a Date.
 */
export function ForwardDayStrip({ selectedIso, onSelectDate, eventCounts }: ForwardDayStripProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const slotCount = useDayStripSlotCount(viewportRef, { reservePickDate: true });
  const todayIso = pacificTodayIso();

  const tiles = useMemo(
    () => buildDayWindowTiles(todayIso, slotCount, eventCounts, todayIso),
    [todayIso, slotCount, eventCounts]
  );

  return (
    <div ref={viewportRef} data-testid="forward-day-strip">
      <DayStrip
        tiles={tiles}
        selectedIso={selectedIso ?? todayIso}
        layout="fill"
        {...(onSelectDate !== undefined ? { onSelectDate } : {})}
      />
    </div>
  );
}
