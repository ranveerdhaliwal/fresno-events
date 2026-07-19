import { SecHead } from "@/components/SecHead";
import { EventRowSkeleton } from "@/components/EventRowSkeleton";
import { UpcomingDetailPanelSkeleton } from "@/components/UpcomingDetailPanelSkeleton";

import styles from "./DaySchedule.module.css";

const PERIODS = [
  { id: "morning", title: "MORNING", script: "early" },
  { id: "afternoon", title: "AFTERNOON", script: "midday" },
  { id: "evening", title: "EVENING & NIGHT", script: "after dark" }
] as const;

export function DayScheduleSkeleton() {
  return (
    <div className={styles.split} data-testid="day-schedule-skeleton" aria-busy="true">
      <div className={styles.listCol}>
        {PERIODS.map((period) => (
          <section key={period.id} className={styles.section}>
            <SecHead title={period.title} script={period.script} count={0} />
            <div className={styles.list}>
              <EventRowSkeleton />
              <EventRowSkeleton />
            </div>
          </section>
        ))}
      </div>
      <div className={styles.detailCol}>
        <UpcomingDetailPanelSkeleton />
      </div>
    </div>
  );
}
