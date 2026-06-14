import { AdSlot } from "@/components/AdSlot";
import { FeatureCard } from "@/components/FeatureCard";
import { PopularList } from "@/components/PopularList";
import { AdminEditLink } from "@/features/admin-mode/AdminEditLink";

import { useHomepageCuration } from "./useHomepageCuration";
import styles from "./FeaturedEvents.module.css";

export function FeaturedEvents() {
  const { viewModel, isLoading } = useHomepageCuration();

  if (isLoading) {
    return <div className={styles.loading}>Loading featured events…</div>;
  }

  const cards = viewModel?.featuredCards ?? [];
  const biggestMonth = viewModel?.biggestMonth ?? [];
  const heroes = cards.slice(0, 2);
  const small = cards.slice(2, 5);

  return (
    <section className={styles.section} data-testid="featured-events">
      <div className={styles.header}>
        <h2>
          <span className={styles.script}>what&apos;s</span> HAPPENING
        </h2>
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
          <AdSlot variant="card" />
        </aside>
      </div>
    </section>
  );
}
