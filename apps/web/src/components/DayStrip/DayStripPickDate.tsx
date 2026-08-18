import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { calendarSearchCurrent } from "@/lib/calendar-search.utils";
import { cn } from "@/lib/cn";
import patternStyles from "@/styles/patterns.module.css";

import styles from "./DayStrip.module.css";

export function DayStripPickDate() {
  return (
    <Link
      to="/calendar"
      search={calendarSearchCurrent()}
      className={cn(styles.tile, patternStyles.hoverLift, styles.selectDate, styles.pickDateFixed)}
      aria-label="Pick a date"
    >
      <Plus className={styles.sdIcon} size={22} />
      <span className={styles.sdLabel}>PICK A DATE</span>
    </Link>
  );
}
