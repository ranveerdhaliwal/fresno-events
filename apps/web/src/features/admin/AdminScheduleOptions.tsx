import type { AdminEventFormState } from "./admin-form.types";
import {
  applyAdminAllDayChange,
  applyAdminStartTimeChange,
  applyAdminTimeTbaChange
} from "./admin-form.utils";

import styles from "./AdminScheduleOptions.module.css";

export interface AdminScheduleOptionsProps {
  draft: AdminEventFormState;
  onChange: (next: AdminEventFormState) => void;
}

export function AdminScheduleOptions({ draft, onChange }: AdminScheduleOptionsProps) {
  const hasStartTime = draft.startTime.trim().length > 0;

  return (
    <div className={styles.root} role="group" aria-label="Schedule options">
      <label className={styles.option}>
        <input
          type="checkbox"
          checked={draft.allDay}
          disabled={hasStartTime}
          onChange={(event) => onChange(applyAdminAllDayChange(draft, event.target.checked))}
        />
        All day
      </label>
      <label className={styles.option}>
        <input
          type="checkbox"
          checked={draft.timeTba}
          disabled={hasStartTime}
          onChange={(event) => onChange(applyAdminTimeTbaChange(draft, event.target.checked))}
        />
        Time TBA
      </label>
      <p className={styles.hint}>
        Set a start time for a specific show time. Otherwise choose all day or time TBA — empty time
        alone does not imply all day.
      </p>
    </div>
  );
}
