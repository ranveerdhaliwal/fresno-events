import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/cn";

import { pacificDowShort } from "./CalendarDayTile.utils";
import type { CalendarDayTileProps } from "./CalendarDayTile.types";
import styles from "./CalendarDayTile.module.css";

export function CalendarDayTile({
  isoDate,
  preview,
  hidden,
  total,
  inMonth,
  isToday,
  isWeekend
}: CalendarDayTileProps) {
  const dayNum = isoDate.slice(8);
  const dow = pacificDowShort(isoDate);

  return (
    <Link
      to="/day/$date"
      params={{ date: isoDate }}
      className={cn(
        styles.tile,
        isToday && styles.today,
        isWeekend && styles.weekend,
        !inMonth && styles.outOfMonth
      )}
      data-testid={`calendar-day-${isoDate}`}
      aria-label={`${dow} ${dayNum}, ${total} events`}
    >
      <div className={styles.dateCorner}>
        <span className={styles.dow}>{dow}</span>
        <span className={styles.dnum}>{dayNum}</span>
      </div>
      <div className={styles.body}>
        {total === 0 ? (
          <p className={styles.empty}>No events</p>
        ) : (
          <ul className={styles.previewList}>
            {preview.map((item) => (
              <li key={item.event.id}>{item.event.title}</li>
            ))}
          </ul>
        )}
        {hidden > 0 ? <span className={styles.more}>+{hidden} more →</span> : null}
      </div>
    </Link>
  );
}
