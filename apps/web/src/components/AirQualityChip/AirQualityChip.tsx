import { airQualityIconFor } from "@fresno-events/shared";

import { Text } from "@/components/Text";
import { useLocalContext } from "@/hooks/useLocalContext";
import { cn } from "@/lib/cn";
import chipStyles from "@/styles/chip.module.css";

import styles from "./AirQualityChip.module.css";

const FRESNO_AIR_QUALITY_SEARCH_URL = "https://www.google.com/search?q=fresno%20air%20quality";

export function AirQualityChip() {
  const { data } = useLocalContext();
  const air = data?.airQuality;

  if (!air?.ok) {
    return null;
  }

  const icon = air.icon || airQualityIconFor(air.aqi, air.category);

  const fullLabel = `${air.category} · ${air.aqi} AQI`;

  return (
    <a
      className={cn(chipStyles.chip, styles.chip)}
      data-testid="air-quality-chip"
      title={fullLabel}
      href={FRESNO_AIR_QUALITY_SEARCH_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fresno air quality — search Google in a new tab"
    >
      <span className={chipStyles.icon} aria-hidden>
        {icon}
      </span>
      <Text variant="body3" tone="onCard" as="span" className={cn(styles.labelFull, chipStyles.chipLabel)}>
        {fullLabel}
      </Text>
      <Text variant="body3" tone="onCard" as="span" className={cn(styles.labelCompact, chipStyles.chipLabel)}>
        {air.aqi} AQI
      </Text>
    </a>
  );
}
