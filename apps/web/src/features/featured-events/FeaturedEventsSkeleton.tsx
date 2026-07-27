import { AdSlot } from "@/components/AdSlot";
import { FeatureCardSkeleton } from "@/components/FeatureCardSkeleton";
import { PopularListSkeleton } from "@/components/PopularListSkeleton";
import { SectionTitle } from "@/components/SectionTitle";

import styles from "./FeaturedEvents.module.css";

export function FeaturedEventsSkeleton() {
  return (
    <section className={styles.section} data-testid="featured-events-skeleton" aria-busy="true">
      <div className={styles.header}>
        <SectionTitle script="what's" size="md">
          HAPPENING
        </SectionTitle>
      </div>

      <div className={styles.layout}>
        <div className={styles.grid}>
          <div className={styles.heroes}>
            <FeatureCardSkeleton variant="hero" />
            <FeatureCardSkeleton variant="hero" />
          </div>
          <div className={styles.smallRow}>
            <FeatureCardSkeleton variant="small" />
            <FeatureCardSkeleton variant="small" />
            <FeatureCardSkeleton variant="small" />
            <FeatureCardSkeleton variant="small" />
          </div>
        </div>
        <aside className={styles.side}>
          <PopularListSkeleton rows={5} />
          <AdSlot variant="card" />
        </aside>
      </div>
    </section>
  );
}
