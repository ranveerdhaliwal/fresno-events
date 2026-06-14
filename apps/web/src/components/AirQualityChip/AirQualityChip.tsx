import { Text } from "@/components/Text";
import { useLocalContext } from "@/hooks/useLocalContext";

import styles from "./AirQualityChip.module.css";

export function AirQualityChip() {
  const { data } = useLocalContext();
  const air = data?.airQuality;

  if (!air?.ok) {
    return null;
  }

  return (
    <span className={styles.chip} data-testid="air-quality-chip">
      <Text variant="body3" tone="onCard" as="span">
        {air.category} · {air.aqi} AQI
      </Text>
    </span>
  );
}
