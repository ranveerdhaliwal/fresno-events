import { EventRowSkeleton } from "@/components/EventRowSkeleton";
import { Skeleton } from "@/components/Skeleton";

import styles from "./EventMap.module.css";

export function EventMapPageSkeleton() {
  return (
    <div className={styles.layout} data-testid="event-map-skeleton" aria-busy="true">
      <aside className={styles.sidebar}>
        <Skeleton height={36} width="100%" />
        <div className={styles.filterChips}>
          <Skeleton height={32} width={72} />
          <Skeleton height={32} width={88} />
          <Skeleton height={32} width={96} />
        </div>
        <div className={styles.sidebarList}>
          {Array.from({ length: 5 }, (_, index) => (
            <EventRowSkeleton key={index} />
          ))}
        </div>
      </aside>
      <div className={styles.mapPane}>
        <Skeleton height="100%" width="100%" radius={0} />
      </div>
    </div>
  );
}
