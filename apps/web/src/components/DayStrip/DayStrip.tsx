import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import type { DayStripTile } from "@/lib/event-view-model";
import { cn } from "@/lib/cn";

import styles from "./DayStrip.module.css";

export interface DayStripProps {
  tiles: DayStripTile[];
}

export function DayStrip({ tiles }: DayStripProps) {
  return (
    <div className={styles.strip} data-testid="day-strip">
      {tiles.map((tile) => (
        <Link
          key={tile.isoDate}
          to="/day/$date"
          params={{ date: tile.isoDate }}
          className={cn(styles.tile, tile.isToday && styles.today, tile.isWeekend && styles.weekend)}
        >
          <span className={styles.dow}>{tile.dow}</span>
          <span className={styles.dnum}>{tile.dayNum}</span>
          <span className={styles.dcount}>{tile.count} events</span>
        </Link>
      ))}
      <button type="button" className={cn(styles.tile, styles.selectDate)} aria-label="Select date">
        <Plus className={styles.sdIcon} size={22} />
        <span className={styles.sdLabel}>PICK A DATE</span>
      </button>
    </div>
  );
}
