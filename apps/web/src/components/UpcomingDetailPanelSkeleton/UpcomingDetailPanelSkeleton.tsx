import { Skeleton } from "@/components/Skeleton";

import styles from "./UpcomingDetailPanelSkeleton.module.css";

export function UpcomingDetailPanelSkeleton() {
  return (
    <div className={styles.panel} data-testid="upcoming-detail-skeleton" aria-hidden>
      <Skeleton className={styles.hero} height={220} radius={0} />
      <div className={styles.body}>
        <Skeleton height={24} width="88%" />
        <Skeleton height={14} width="100%" />
        <Skeleton height={14} width="92%" />
        <div className={styles.facts}>
          <Skeleton height={12} width="22%" />
          <Skeleton height={16} width="64%" />
          <Skeleton height={12} width="22%" />
          <Skeleton height={16} width="54%" />
        </div>
        <Skeleton height={40} width="100%" radius={0} />
      </div>
    </div>
  );
}
