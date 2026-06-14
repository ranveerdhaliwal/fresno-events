import { Text } from "@/components/Text";
import { useLocalContext } from "@/hooks/useLocalContext";

import styles from "./WeatherChip.module.css";

export function WeatherChip() {
  const { data } = useLocalContext();
  const weather = data?.weather;

  if (!weather?.ok) {
    return null;
  }

  return (
    <span className={styles.chip} data-testid="weather-chip">
      <Text variant="body3" tone="onCard" as="span">
        {weather.icon} {weather.tempF}°F · {weather.condition}
      </Text>
    </span>
  );
}
