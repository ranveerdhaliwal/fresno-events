import { Skeleton } from "@/components/Skeleton";

import styles from "./EventDetailView.module.css";
import skeletonStyles from "./EventDetailSkeleton.module.css";

function SectionHeadSkeleton() {
  return <Skeleton height={40} width="100%" radius={0} className={skeletonStyles.headGap} />;
}

export function EventDetailSkeleton() {
  return (
    <article className={styles.article} data-testid="event-detail-skeleton" aria-busy="true">
      <div className={styles.crumbs}>
        <Skeleton height={13} width={90} />
        <span className={styles.sep}>/</span>
        <Skeleton height={13} width={110} />
        <span className={styles.sep}>/</span>
        <Skeleton height={13} width={160} />
        <Skeleton height={28} width={120} className={styles.back} />
      </div>

      <div className={styles.heroWrap}>
        <Skeleton className={styles.hero} height={420} radius={0} />
      </div>

      <div className={styles.quickFacts}>
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className={`${styles.fact} ${skeletonStyles.factLines}`}>
            <Skeleton height={10} width={48} />
            <Skeleton height={18} width="72%" />
            <Skeleton height={12} width="52%" />
          </div>
        ))}
      </div>

      <div className={styles.content}>
        <div className={styles.mainCol}>
          <section className={styles.sec}>
            <SectionHeadSkeleton />
            <div className={skeletonStyles.lines}>
              <Skeleton height={15} width="100%" />
              <Skeleton height={15} width="97%" />
              <Skeleton height={15} width="90%" />
              <Skeleton height={15} width="94%" />
              <Skeleton height={15} width="60%" />
            </div>
          </section>

          <section className={styles.sec}>
            <SectionHeadSkeleton />
            <div className={skeletonStyles.lines}>
              <Skeleton height={220} width="100%" radius={0} />
              <Skeleton height={15} width="45%" />
            </div>
          </section>

          <section className={styles.sec}>
            <SectionHeadSkeleton />
            <div className={styles.sourceBox}>
              <Skeleton height={15} width="40%" />
              <Skeleton height={13} width="90%" />
              <Skeleton height={13} width="70%" />
            </div>
          </section>
        </div>

        <aside className={styles.sideCol}>
          <div className={styles.sideCard}>
            <Skeleton height={14} width={80} className={skeletonStyles.headGap} />
            <div className={styles.organizer}>
              <Skeleton circle height={48} />
              <div className={skeletonStyles.orgLines}>
                <Skeleton height={16} width="70%" />
                <Skeleton height={12} width="45%" />
                <Skeleton height={12} width="60%" />
              </div>
            </div>
          </div>

          <div className={styles.sideCard}>
            <Skeleton height={14} width={60} className={skeletonStyles.headGap} />
            <div className={styles.tags}>
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} height={24} width={68} radius={999} />
              ))}
            </div>
          </div>

          <Skeleton height={140} width="100%" radius={0} />
          <Skeleton height={260} width="100%" radius={0} />
        </aside>
      </div>
    </article>
  );
}
