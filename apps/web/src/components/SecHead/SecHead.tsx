import { Text } from "@/components/Text";
import { cn } from "@/lib/cn";

import styles from "./SecHead.module.css";

export interface SecHeadGroupSelectAll {
  checked: boolean;
  onChange: () => void;
}

export interface SecHeadProps {
  number?: string;
  script?: string;
  title: string;
  count?: number;
  variant?: "default" | "live";
  /** Per-section bulk select (admin source groups). */
  groupSelectAll?: SecHeadGroupSelectAll;
}

export function SecHead({
  number,
  script,
  title,
  count,
  variant = "default",
  groupSelectAll
}: SecHeadProps) {
  return (
    <div className={cn(styles.head, variant === "live" && styles.live)} data-testid="sec-head">
      <div className={styles.lead}>
        <Text variant="eyebrow" tone="inherit" as="h2" className={styles.title}>
          {groupSelectAll ? (
            <label className={styles.groupSelectAll} aria-label={`Select all ${title}`}>
              <input
                type="checkbox"
                checked={groupSelectAll.checked}
                onChange={groupSelectAll.onChange}
              />
            </label>
          ) : null}
          {variant === "live" ? <span className={styles.liveDot} aria-hidden /> : null}
          {script ? (
            <Text variant="script" tone="onNav" scriptStyle="nav" as="span" className={styles.script}>
              {script}
            </Text>
          ) : null}
          {title}
        </Text>
      </div>
      {count !== undefined ? (
        <Text variant="eyebrow" tone="inverse" as="span" className={styles.count}>
          {count}
        </Text>
      ) : number ? (
        <Text variant="eyebrow" tone="inverse" as="span" className={styles.count}>
          {number}
        </Text>
      ) : null}
    </div>
  );
}
