import { cn } from "@/lib/cn";
import { Text } from "@/components/Text";
import type { DayStripTile } from "@/lib/event-view-model";

import styles from "./DayStrip.module.css";

export interface DayStripTilesProps {
  tiles: DayStripTile[];
  selectedIso?: string;
  onSelectDate?: (isoDate: string) => void;
  tileWidth?: number;
}

function TileContent({ tile }: { tile: DayStripTile }) {
  return (
    <>
      <Text variant="eyebrow" tone="inherit" as="span" className={styles.dow}>
        {tile.dow}
      </Text>
      <Text variant="header2" tone="inherit" as="span" className={styles.dnum}>
        {tile.dayNum}
      </Text>
      <Text variant="body3" tone="inherit" as="span" className={styles.dcount}>
        {tile.count} events
      </Text>
    </>
  );
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
              <TileContent tile={tile} />
            </button>
          );
        }

        return (
          <div key={tile.isoDate} className={className} style={style}>
            <TileContent tile={tile} />
          </div>
        );
      })}
    </>
  );
}
