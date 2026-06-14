import { cn } from "@/lib/cn";
import type { DayStripTile } from "@/lib/event-view-model";

import styles from "./DayStrip.module.css";

export interface DayStripTilesProps {
  tiles: DayStripTile[];
  selectedIso?: string;
  onSelectDate?: (isoDate: string) => void;
  tileWidth?: number;
}

export function DayStripTiles({ tiles, selectedIso, onSelectDate, tileWidth }: DayStripTilesProps) {
  return (
    <>
      {tiles.map((tile) => {
        const className = cn(
          styles.tile,
          tile.isToday && styles.today,
          tile.isWeekend && styles.weekend,
          selectedIso === tile.isoDate && styles.selected
        );

        const style = tileWidth !== undefined ? { width: tileWidth, flexShrink: 0 } : undefined;

        if (onSelectDate) {
          return (
            <button
              key={tile.isoDate}
              type="button"
              className={className}
              style={style}
              onClick={() => onSelectDate(tile.isoDate)}
            >
              <span className={styles.dow}>{tile.dow}</span>
              <span className={styles.dnum}>{tile.dayNum}</span>
              <span className={styles.dcount}>{tile.count} events</span>
            </button>
          );
        }

        return (
          <div key={tile.isoDate} className={className} style={style}>
            <span className={styles.dow}>{tile.dow}</span>
            <span className={styles.dnum}>{tile.dayNum}</span>
            <span className={styles.dcount}>{tile.count} events</span>
          </div>
        );
      })}
    </>
  );
}
