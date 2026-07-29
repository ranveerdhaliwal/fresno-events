import { Button } from "@/components/Button/Button";
import { formatEventDate } from "@/lib/event-time";

import styles from "./SeeAllDayCta.module.css";

export interface SeeAllDayCtaProps {
  date: string;
  count: number;
  /** @deprecated Both breakpoints use the same mustard button. */
  variant?: "desktop" | "mobile";
}

export function SeeAllDayCta({ date, count }: SeeAllDayCtaProps) {
  const dayLabel = formatEventDate(new Date(`${date}T12:00:00-07:00`));
  const label = `See all ${count} events on ${dayLabel} →`;

  return (
    <div className={styles.wrap}>
      <Button
        to="/day/$date"
        params={{ date }}
        variant="mustard"
        size="md"
        className={styles.btn}
        data-testid="see-all-day-cta"
      >
        {label}
      </Button>
    </div>
  );
}
