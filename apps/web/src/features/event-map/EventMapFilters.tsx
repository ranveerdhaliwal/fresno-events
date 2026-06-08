import type { DatePreset } from "@/lib/date-presets";

import styles from "./EventMap.module.css";

const DATE_CHIPS: Array<{ id: DatePreset | null; label: string }> = [
  { id: null, label: "All" },
  { id: "tonight", label: "Tonight" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "weekend", label: "Weekend" },
  { id: "week", label: "This week" }
];

export interface EventMapFiltersProps {
  q: string;
  datePreset: DatePreset | null;
  showList: boolean;
  omittedNoCoords: number;
  pinCount: number;
  onQueryChange: (value: string) => void;
  onDatePresetChange: (value: DatePreset | null) => void;
  onToggleList: () => void;
  onNearMe: () => void;
}

export function EventMapFilters({
  q,
  datePreset,
  showList,
  omittedNoCoords,
  pinCount,
  onQueryChange,
  onDatePresetChange,
  onToggleList,
  onNearMe
}: EventMapFiltersProps) {
  return (
    <div className={styles.filters}>
      <input
        className={styles.searchInput}
        value={q}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Filter events or venues…"
        aria-label="Map filter"
      />
      {DATE_CHIPS.map((chip) => (
        <button
          key={chip.label}
          type="button"
          className={datePreset === chip.id ? styles.chipActive : styles.chip}
          onClick={() => onDatePresetChange(chip.id)}
        >
          {chip.label}
        </button>
      ))}
      <button type="button" className={styles.chip} onClick={onNearMe}>
        Near Fresno
      </button>
      <button type="button" className={styles.toggle} onClick={onToggleList}>
        {showList ? "Map only" : "Map + list"}
      </button>
      <span className={styles.meta}>
        {pinCount} pins
        {omittedNoCoords > 0 ? ` · ${omittedNoCoords} hidden (no coordinates)` : ""}
      </span>
    </div>
  );
}
