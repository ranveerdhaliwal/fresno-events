import { useMemo, useState } from "react";

import { AdSlot } from "@/components/AdSlot";
import { DayPicker } from "@/components/DayPicker";
import { FeatureCard } from "@/components/FeatureCard";
import { PopularList } from "@/components/PopularList";
import { AdminEditLink } from "@/features/admin-mode/AdminEditLink";
import type { FeaturedBadge } from "@/lib/event-view-model";

import { filterFeaturedCards, useHomepageCuration } from "./useHomepageCuration";
import styles from "./FeaturedEvents.module.css";

const TABS: { id: "all" | FeaturedBadge; label: string }[] = [
  { id: "all", label: "TODAY" },
  { id: "tonight", label: "THIS WEEK" },
  { id: "weekend", label: "THIS WEEKEND" }
];

export function FeaturedEvents() {
  const { viewModel, isLoading } = useHomepageCuration();
  const [tab, setTab] = useState<"all" | FeaturedBadge>("all");

  const cards = useMemo(() => {
    if (!viewModel) return [];
    return filterFeaturedCards(viewModel.featuredCards, tab);
  }, [viewModel, tab]);

  const popular = viewModel?.popularEvents ?? [];

  if (isLoading) {
    return <div className={styles.loading}>Loading featured events…</div>;
  }

  const heroes = cards.slice(0, 2);
  const small = cards.slice(2, 5);

  return (
    <section className={styles.section} data-testid="featured-events">
      <div className={styles.header}>
        <h2>
          <span className={styles.script}>what&apos;s</span> HAPPENING
        </h2>
        <div className={styles.tabsDesktop}>
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? styles.tabActive : styles.tab}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tabsMobile}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? styles.pillActive : styles.pill}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
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
          <PopularList events={popular} count={popular.length} renderAdminEdit={(eventId) => <AdminEditLink eventId={eventId} />} />
          <DayPicker />
          <AdSlot variant="card" />
        </aside>
      </div>
    </section>
  );
}
