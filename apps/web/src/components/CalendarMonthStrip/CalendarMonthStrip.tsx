import { Link } from "@tanstack/react-router";
import { buildNextPacificMonths } from "@fresno-events/shared";

import { cn } from "@/lib/cn";

import styles from "./CalendarMonthStrip.module.css";

export interface CalendarMonthStripProps {
  selectedYear: number;
  selectedMonth: number;
}

export function CalendarMonthStrip({ selectedYear, selectedMonth }: CalendarMonthStripProps) {
  const months = buildNextPacificMonths(12);

  return (
    <section className={styles.section} data-testid="calendar-month-strip">
      <h2 className={styles.heading}>
        <span className={styles.script}>pick a</span> MONTH
      </h2>
      <div className={styles.strip}>
        {months.map((tile) => {
          const isSelected = tile.year === selectedYear && tile.month === selectedMonth;
          return (
            <Link
              key={`${tile.year}-${tile.month}`}
              to="/calendar"
              search={{ year: tile.year, month: tile.month }}
              className={cn(styles.tile, isSelected && styles.selected)}
              aria-current={isSelected ? "page" : undefined}
            >
              <span className={styles.short}>{tile.shortLabel}</span>
              <span className={styles.year}>{tile.yearLabel}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
