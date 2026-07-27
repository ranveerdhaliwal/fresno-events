import { Text } from "@/components/Text";
import { useLocalContext } from "@/hooks/useLocalContext";
import { cn } from "@/lib/cn";
import chipStyles from "@/styles/chip.module.css";

import styles from "./WeatherChip.module.css";

const FRESNO_WEATHER_SEARCH_URL = "https://www.google.com/search?q=fresno%20weather";

export function WeatherChip() {
  const { data } = useLocalContext();
  const weather = data?.weather;

  if (!weather?.ok) {
    return null;
  }

  return (
    <a
      className={cn(chipStyles.chip, styles.chip)}
      data-testid="weather-chip"
      href={FRESNO_WEATHER_SEARCH_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Fresno weather — search Google in a new tab"
    >
      <span className={chipStyles.icon} aria-hidden>
        {weather.icon}
      </span>
      <Text variant="body3" tone="onCard" as="span">
        {weather.tempF}°F · {weather.condition}
      </Text>
    </a>
  );
}
