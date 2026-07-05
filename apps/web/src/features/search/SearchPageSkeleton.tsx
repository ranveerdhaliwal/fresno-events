import { EventRowSkeleton } from "@/components/EventRowSkeleton";
import { Skeleton } from "@/components/Skeleton";
import { UpcomingDetailPanelSkeleton } from "@/components/UpcomingDetailPanelSkeleton";

import styles from "./SearchPage.module.css";

export function SearchPageSkeleton() {
  return (
    <div className={styles.split} data-testid="search-page-skeleton" aria-busy="true">
      <div className={styles.listCol}>
        <section className={styles.section}>
          <Skeleton height={22} width={180} />
          <div className={styles.list}>
            {Array.from({ length: 6 }, (_, index) => (
              <EventRowSkeleton key={index} />
            ))}
          </div>
        </section>
      </div>
      <UpcomingDetailPanelSkeleton />
    </div>
  );
}
