import { SectionTitle } from "@/components/SectionTitle";
import { Skeleton } from "@/components/Skeleton";
import { EventRowSkeleton } from "@/components/EventRowSkeleton";
import { UpcomingDetailPanelSkeleton } from "@/components/UpcomingDetailPanelSkeleton";

import styles from "./CalendarPage.module.css";

const DOW_HEADERS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export interface CalendarPageSkeletonProps {
  monthLabel: string;
}

export function CalendarPageSkeleton({ monthLabel }: CalendarPageSkeletonProps) {
  return (
    <div data-testid="calendar-page-skeleton" aria-busy="true">
      <header className={styles.head}>
        <SectionTitle script="the" size="lg" as="h1">
          {monthLabel.toUpperCase()}
        </SectionTitle>
      </header>

      <div className={styles.dowRow}>
        {DOW_HEADERS.map((label) => (
          <Skeleton key={label} height={12} width={28} />
        ))}
      </div>

      <div className={styles.grid}>
        {Array.from({ length: 35 }, (_, index) => (
          <Skeleton key={index} className={styles.tileSkeleton} height={120} radius={0} />
        ))}
      </div>

      <div className={styles.split}>
        <div className={styles.weekList}>
          <Skeleton height={20} width={220} />
          {Array.from({ length: 4 }, (_, index) => (
            <EventRowSkeleton key={index} />
          ))}
        </div>
        <UpcomingDetailPanelSkeleton />
      </div>
    </div>
  );
}
