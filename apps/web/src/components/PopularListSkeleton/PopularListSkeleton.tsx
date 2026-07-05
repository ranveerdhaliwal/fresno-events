import { Skeleton } from "@/components/Skeleton";

import styles from "./PopularListSkeleton.module.css";

export function PopularListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className={styles.card} data-testid="popular-list-skeleton" aria-hidden>
      <div className={styles.head}>
        <Skeleton height={12} width="70%" animate={false} />
        <Skeleton height={18} width={24} circle />
      </div>
      <ul className={styles.list}>
        {Array.from({ length: rows }, (_, index) => (
          <li key={index}>
            <Skeleton height={14} width={16} />
            <div className={styles.line}>
              <Skeleton height={14} width="78%" />
              <Skeleton height={11} width="52%" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
