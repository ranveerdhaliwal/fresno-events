import { FeatureCard } from "@/components/FeatureCard";
import { PopularList } from "@/components/PopularList";
import { SectionTitle } from "@/components/SectionTitle";
import { AdminEditLink } from "@/features/admin-mode/AdminEditLink";

import { useHomepageCuration } from "./useHomepageCuration";
import { FeaturedEventsSkeleton } from "./FeaturedEventsSkeleton";
import styles from "./FeaturedEvents.module.css";

export function FeaturedEvents() {
  const { viewModel, isLoading } = useHomepageCuration();

  if (isLoading) {
    return <FeaturedEventsSkeleton />;
  }

  const cards = viewModel?.featuredCards ?? [];
  const biggestMonth = viewModel?.biggestMonth ?? [];
  const heroes = cards.slice(0, 2);
  const small = cards.slice(2, 6);

  return (
    <section className={styles.section} data-testid="featured-events">
      <div className={styles.header}>
        <SectionTitle script="what's" size="md">
          HAPPENING
        </SectionTitle>
      </div>

      <div className={styles.layout}>
        <div className={styles.grid}>
          <div className={styles.heroes}>
            {heroes.map((card) => (
              <div key={card.id} className={styles.cardWrap}>
                <FeatureCard card={card} variant="hero" />
                <AdminEditLink eventId={card.id} className={styles.adminEdit} />
              </div>
            ))}
          </div>
          <div className={styles.smallRow}>
            {small.map((card) => (
              <div key={card.id} className={styles.cardWrap}>
                <FeatureCard card={card} variant="small" />
                <AdminEditLink eventId={card.id} className={styles.adminEdit} />
              </div>
            ))}
          </div>
        </div>
        <aside className={styles.side}>
          <PopularList
            title="BIGGEST EVENTS THIS MONTH"
            events={biggestMonth}
            count={biggestMonth.length}
            renderAdminEdit={(eventId) => <AdminEditLink eventId={eventId} />}
          />
        </aside>
      </div>
    </section>
  );
}
