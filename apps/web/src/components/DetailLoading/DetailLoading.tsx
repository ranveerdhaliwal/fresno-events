import { Skeleton } from "@/components/Skeleton";

import styles from "./DetailLoading.module.css";

export function DetailLoading() {
  return (
    <div className={styles.placeholder} data-testid="detail-loading-skeleton" aria-busy="true">
      <Skeleton height={24} width="72%" />
      <Skeleton height={14} width="48%" />
      <Skeleton height={220} width="100%" radius={0} />
      <div className={styles.block}>
        <Skeleton height={18} width={140} />
        <Skeleton height={14} width="100%" />
        <Skeleton height={14} width="94%" />
        <Skeleton height={14} width="86%" />
      </div>
      <div className={styles.actions}>
        <Skeleton height={36} width={120} radius={999} />
        <Skeleton height={36} width={120} radius={999} />
      </div>
    </div>
  );
}
