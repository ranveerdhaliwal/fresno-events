import { Link } from "@tanstack/react-router";
import { useMemo } from "react";

import { Text } from "@/components/Text";
import { cn } from "@/lib/cn";

import { collapseCalendarPreview, pacificDowShort } from "./CalendarDayTile.utils";
import type { CalendarDayTileProps } from "./CalendarDayTile.types";
import styles from "./CalendarDayTile.module.css";
import patternStyles from "@/styles/patterns.module.css";

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
  const collapsed = useMemo(() => collapseCalendarPreview(preview), [preview]);

  return (
    <Link
      to="/day/$date"
      params={{ date: isoDate }}
      className={cn(
        styles.tile,
        patternStyles.hoverLift,
        isToday && styles.today,
        isWeekend && styles.weekend,
        !inMonth && styles.outOfMonth
      )}
      data-testid={`calendar-day-${isoDate}`}
    >
      <div className={styles.dateCorner}>
        <Text variant="eyebrow" tone="inherit" as="span" className={styles.dow}>
          {dow}
        </Text>
        <Text variant="header1" tone="inherit" as="span" className={styles.dnum}>
          {dayNum}
        </Text>
      </div>
      <div className={styles.body}>
        {total === 0 ? (
          <Text variant="body3" tone="inherit" as="p" className={styles.empty}>
            No events
          </Text>
        ) : (
          <ul className={styles.previewList}>
            {collapsed.map((item) => (
              <li key={item.id} className={styles.previewRow}>
                {item.thumbUrl ? (
                  <img
                    src={item.thumbUrl}
                    alt=""
                    className={styles.thumb}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className={styles.thumbFallback} aria-hidden="true" />
                )}
                <Text variant="body3" tone="onCard" as="span" className={styles.previewTitle}>
                  {item.title}
                  {item.occurrenceCount > 1 ? (
                    <span className={styles.occCount}> ×{item.occurrenceCount}</span>
                  ) : null}
                </Text>
              </li>
            ))}
          </ul>
        )}
        {hidden > 0 ? (
          <Text variant="body3" tone="inherit" as="span" className={styles.more}>
            +{hidden} more →
          </Text>
        ) : null}
      </div>
    </Link>
  );
}
