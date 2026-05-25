import styles from "./WeatherChip.module.css";

export function WeatherChip() {
  return (
    <span className={styles.chip} data-testid="weather-chip">
      ☀️ 82° · Clear
    </span>
  );
}
