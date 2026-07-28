import { Text } from "@/components/Text";
import { capitalizeScriptPhrase } from "@/lib/section-script.utils";

import styles from "./WeekBlockHeader.module.css";

export interface WeekBlockHeaderProps {
  /** Section label after the script word, e.g. "TODAY" / "THIS WEEK". */
  label: string;
  /** Optional short day/time cue (not an ISO range). */
  dateLabel?: string;
  /** Script word before the label. Defaults to "events". */
  script?: string;
}

export function WeekBlockHeader({ label, dateLabel, script = "events" }: WeekBlockHeaderProps) {
  return (
    <div className={styles.header} data-testid="week-block-header">
      <Text variant="script" tone="brand" scriptStyle="section" stroke="onDark" as="span" className={styles.script}>
        {capitalizeScriptPhrase(script)}
      </Text>
      <Text variant="header3" tone="onPage" stroke="onDark" as="h3" className={styles.label}>
        {label}
      </Text>
      {dateLabel ? (
        <Text variant="body3" tone="onPage" stroke="onDark" as="span" className={styles.dates}>
          {dateLabel}
        </Text>
      ) : null}
    </div>
  );
}
