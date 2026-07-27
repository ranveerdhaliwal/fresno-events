import { Text } from "@/components/Text";
import { cn } from "@/lib/cn";

import styles from "./DateChip.module.css";

export interface DateChipProps {
  dayShort: string;
  dayNum: string;
  /** Row variant only — omitted for the compact card chip. */
  monthShort?: string;
  /** "card" = compact dow+num chip (EventCard). "row" = larger dow+num+month box (EventRow). */
  variant: "card" | "row";
  className?: string | undefined;
}

export function DateChip({ dayShort, dayNum, monthShort, variant, className }: DateChipProps) {
  return (
    <div className={cn(styles.chip, styles[variant], className)}>
      <Text variant="eyebrow" tone={variant === "row" ? "accent" : "onCard"} as="span" className={styles.dow}>
        {dayShort}
      </Text>
      <Text variant="header2" tone="onCard" as="span" className={styles.num}>
        {dayNum}
      </Text>
      {variant === "row" && monthShort ? (
        <Text variant="body3" tone="mutedOnCard" as="span" className={styles.month}>
          {monthShort}
        </Text>
      ) : null}
    </div>
  );
}
