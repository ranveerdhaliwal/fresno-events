import { Skeleton } from "@/components/Skeleton";

import styles from "./HomepageCurationWorkspace.module.css";

export function HomepageCurationWorkspaceSkeleton() {
  return (
    <div className={styles.workspace} data-testid="homepage-curation-skeleton" aria-busy="true">
      <header className={styles.header}>
        <div>
          <Skeleton height={11} width={160} />
          <Skeleton height={28} width={220} className={styles.title} />
          <Skeleton height={14} width="min(40rem, 100%)" className={styles.subtitle} />
        </div>
        <div className={styles.actions}>
          <Skeleton height={40} width={180} />
          <Skeleton height={40} width={120} radius={999} />
        </div>
      </header>

      <div className={styles.sections}>
        <section className={styles.section}>
          <Skeleton height={18} width={280} className={styles.sectionTitle} />
          <div className={styles.slotGrid}>
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className={styles.slot}>
                <Skeleton height={12} width={64} />
                <Skeleton height={72} width="100%" />
                <Skeleton height={32} width="100%" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
