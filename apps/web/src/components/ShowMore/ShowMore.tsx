import { Text } from "@/components/Text";

import styles from "./ShowMore.module.css";

export function ShowMore({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" className={styles.btn} onClick={onClick} data-testid="show-more">
      <Text variant="eyebrow" tone="inherit" as="span">
        SHOW MORE EVENTS ↓
      </Text>
    </button>
  );
}
