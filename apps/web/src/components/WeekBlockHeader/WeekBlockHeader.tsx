import { Text } from "@/components/Text";

import styles from "./WeekBlockHeader.module.css";

export interface WeekBlockHeaderProps {
  label: string;
  dateRange: string;
}

export function WeekBlockHeader({ label, dateRange }: WeekBlockHeaderProps) {
  return (
    <div className={styles.header} data-testid="week-block-header">
      <Text variant="script" tone="accent" scriptStyle="section" as="span" className={styles.script}>
        next
      </Text>
      <Text variant="header3" tone="onPage" as="h3">
        {label}
      </Text>
      <Text variant="body3" tone="mutedOnPage" as="span" className={styles.dates}>
        {dateRange}
      </Text>
    </div>
  );
}
