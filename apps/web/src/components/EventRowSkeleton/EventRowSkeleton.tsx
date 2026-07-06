import { Skeleton } from "@/components/Skeleton";

import styles from "./EventRowSkeleton.module.css";

export function EventRowSkeleton() {
  return (
    <div className={styles.row} data-testid="event-row-skeleton" aria-hidden>
      <div className={styles.date}>
        <Skeleton height={10} width={28} />
        <Skeleton height={22} width={32} />
      </div>
      <Skeleton className={styles.thumb} height={80} width={80} radius={0} />
      <div className={styles.body}>
        <Skeleton height={16} width="72%" />
        <Skeleton height={11} width="55%" />
        <Skeleton height={10} width="32%" />
      </div>
      <Skeleton height={14} width={48} />
    </div>
  );
}
