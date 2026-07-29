import { PageChrome } from "@/components/PageChrome";
import { Text } from "@/components/Text";
import { AdSlot } from "@/components/AdSlot";
import { FeaturedEvents } from "@/features/featured-events/FeaturedEvents";
import { TodayStrip } from "@/features/today-strip/TodayStrip";
import { UpcomingEvents } from "@/features/upcoming-events/UpcomingEvents";
import { useSeoHead } from "@/lib/seo/useSeoHead";
import { buildHomeSeo } from "@/lib/seo/page-seo";

import styles from "./HomePage.module.css";

export function HomePage() {
  useSeoHead(buildHomeSeo());

  return (
    <PageChrome mobileNav={{ variant: "home" }}>
      <div className={styles.home} data-testid="home-page">
        <Text variant="header1" tone="onPage" stroke="onDark" className={styles.pageTitle}>
          Events in Fresno &amp; the Central Valley
        </Text>
        <FeaturedEvents />
        <AdSlot variant="banner-wide" />
        <TodayStrip />
        <section className={styles.upcomingSection}>
          <UpcomingEvents />
          <AdSlot variant="banner-footer" />
        </section>
      </div>
    </PageChrome>
  );
}
