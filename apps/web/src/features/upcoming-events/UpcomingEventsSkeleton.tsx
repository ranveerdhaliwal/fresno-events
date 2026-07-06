import { EventRowSkeleton } from "@/components/EventRowSkeleton";
import { FilterChip } from "@/components/FilterChip";
import { SectionTitle } from "@/components/SectionTitle";
import { Skeleton } from "@/components/Skeleton";
import { UpcomingDetailPanelSkeleton } from "@/components/UpcomingDetailPanelSkeleton";

import styles from "./UpcomingEvents.module.css";

const FILTERS = ["All", "Today", "This weekend"] as const;

function SectionBlockSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <section className={styles.sectionBlock}>
      <div className={styles.toolbar}>
        <Skeleton height={14} width={120} />
        <Skeleton height={12} width={160} />
      </div>
      <div className={styles.list}>
        {Array.from({ length: rows }, (_, index) => (
          <EventRowSkeleton key={index} />
        ))}
      </div>
    </section>
  );
}

export function UpcomingEventsSkeleton() {
  return (
    <div className={styles.wrap} data-testid="upcoming-events-skeleton" aria-busy="true">
      <div className={styles.toolbar}>
        <SectionTitle as="h2" script="upcoming" size="sm">
          EVENTS
        </SectionTitle>
      </div>

      <div className={styles.chips}>
        {FILTERS.map((chip) => (
          <FilterChip key={chip} active={chip === "All"} type="button">
            {chip}
          </FilterChip>
        ))}
      </div>

      <div className={styles.split}>
        <div className={styles.listCol}>
          <SectionBlockSkeleton rows={3} />
          <SectionBlockSkeleton rows={4} />
        </div>
        <div className={styles.detailCol}>
          <UpcomingDetailPanelSkeleton />
        </div>
      </div>
    </div>
  );
}
