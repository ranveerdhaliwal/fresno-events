import { Link } from "@tanstack/react-router";
import { buildNextPacificMonths } from "@fresno-events/shared";

import { SectionTitle } from "@/components/SectionTitle";
import { Text } from "@/components/Text";
import { cn } from "@/lib/cn";

import styles from "./CalendarMonthStrip.module.css";
import patternStyles from "@/styles/patterns.module.css";

export interface CalendarMonthStripProps {
  selectedYear: number;
  selectedMonth: number;
}

export function CalendarMonthStrip({ selectedYear, selectedMonth }: CalendarMonthStripProps) {
  const months = buildNextPacificMonths(12);

  return (
    <section className={styles.section} data-testid="calendar-month-strip">
      <SectionTitle script="pick a" size="sm" className={styles.heading}>
        MONTH
      </SectionTitle>
      <div className={styles.strip}>
        {months.map((tile) => {
          const isSelected = tile.year === selectedYear && tile.month === selectedMonth;
          return (
            <Link
              key={`${tile.year}-${tile.month}`}
              to="/calendar"
              search={{ year: tile.year, month: tile.month }}
              className={cn(styles.tile, patternStyles.hoverLift, isSelected && styles.selected)}
              aria-current={isSelected ? "page" : undefined}
            >
              <Text variant="eyebrow" tone="inherit" as="span" className={styles.short}>
                {tile.shortLabel}
              </Text>
              <Text variant="body3" tone="inherit" as="span" className={styles.year}>
                {tile.yearLabel}
              </Text>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
