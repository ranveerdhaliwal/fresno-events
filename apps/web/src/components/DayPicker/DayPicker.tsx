import { Link } from "@tanstack/react-router";

import { toIsoDateLocal } from "@/lib/event-time";
import { cn } from "@/lib/cn";

import styles from "./DayPicker.module.css";

export interface DayPickerProps {
  anchor?: Date;
}

export function DayPicker({ anchor = new Date() }: DayPickerProps) {
  const tiles = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() + index);
    const iso = toIsoDateLocal(date);
    const isToday = index === 0;
    return {
      iso,
      dow: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Los_Angeles" })
        .format(date)
        .toUpperCase(),
      dnum: new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "America/Los_Angeles" }).format(date),
      isToday
    };
  });

  return (
    <div className={styles.picker} data-testid="day-picker">
      <div className={styles.head}>
        <h3>THIS WEEK</h3>
        <Link to="/calendar">Full calendar →</Link>
      </div>
      <div className={styles.days}>
        {tiles.map((tile) => (
          <Link
            key={tile.iso}
            to="/day/$date"
            params={{ date: tile.iso }}
            className={cn(styles.day, tile.isToday && styles.today)}
          >
            <span className={styles.dow}>{tile.dow}</span>
            <span className={styles.dnum}>{tile.dnum}</span>
          </Link>
        ))}
      </div>
      <button type="button" className={styles.pick}>
        PICK A DATE
      </button>
    </div>
  );
}
