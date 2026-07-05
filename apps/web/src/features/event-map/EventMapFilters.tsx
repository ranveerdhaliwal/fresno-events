import { FilterChip } from "@/components/FilterChip";
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
  omittedNoCoords: number;
  pinCount: number;
  onQueryChange: (value: string) => void;
  onDatePresetChange: (value: DatePreset | null) => void;
  onNearMe: () => void;
}

export function EventMapFilters({
  q,
  datePreset,
  omittedNoCoords,
  pinCount,
  onQueryChange,
  onDatePresetChange,
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
      <div className={styles.filterChips}>
        {DATE_CHIPS.map((chip) => (
          <FilterChip
            key={chip.label}
            active={datePreset === chip.id}
            onClick={() => onDatePresetChange(chip.id)}
          >
            {chip.label}
          </FilterChip>
        ))}
        <FilterChip onClick={onNearMe}>Near Fresno</FilterChip>
      </div>
      <span className={styles.meta}>
        {pinCount} pins
        {omittedNoCoords > 0 ? ` · ${omittedNoCoords} hidden (no coordinates)` : ""}
      </span>
    </div>
  );
}
