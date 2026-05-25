import { List, Calendar } from "lucide-react";

import { cn } from "@/lib/cn";

import styles from "./ViewToggle.module.css";

export type ViewMode = "list" | "calendar";

export interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className={styles.toggle} data-testid="view-toggle">
      <button
        type="button"
        className={cn(value === "list" && styles.active)}
        onClick={() => onChange("list")}
        aria-pressed={value === "list"}
      >
        <List size={14} /> LIST
      </button>
      <button
        type="button"
        className={cn(value === "calendar" && styles.active)}
        onClick={() => onChange("calendar")}
        aria-pressed={value === "calendar"}
      >
        <Calendar size={14} /> CAL
      </button>
    </div>
  );
}
