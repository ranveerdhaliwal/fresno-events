import type { CSSProperties } from "react";

import type { DayStripTile } from "@/lib/event-view-model";
import { cn } from "@/lib/cn";

import { DayStripPickDate } from "./DayStripPickDate";
import { DayStripTiles } from "./DayStripTiles";
import styles from "./DayStrip.module.css";

export interface DayStripProps {
  tiles: DayStripTile[];
  selectedIso?: string;
  onSelectDate?: (isoDate: string) => void;
  /** scroll = horizontal strip; fill = grid row that spans container width */
  layout?: "scroll" | "fill";
  showPickDate?: boolean;
}

export function DayStrip({
  tiles,
  selectedIso,
  onSelectDate,
  layout = "scroll",
  showPickDate = true
}: DayStripProps) {
  return (
    <div
      className={cn(styles.strip, layout === "fill" && styles.stripFill)}
      data-testid="day-strip"
      style={
        layout === "fill"
          ? ({ "--day-slot-count": tiles.length } as CSSProperties)
          : undefined
      }
    >
      <DayStripTiles
        tiles={tiles}
        {...(selectedIso !== undefined ? { selectedIso } : {})}
        {...(onSelectDate !== undefined ? { onSelectDate } : {})}
      />
      {showPickDate ? <DayStripPickDate /> : null}
    </div>
  );
}
