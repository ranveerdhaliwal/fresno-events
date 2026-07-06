import { RainbowStripe } from "@/components/RainbowStripe";
import { Text } from "@/components/Text";
import { TopNav } from "@/components/TopNav";
import { MobileNav } from "@/components/MobileNav";
import { AdSlot } from "@/components/AdSlot";
import { SiteFooter } from "@/components/SiteFooter";
import { FeaturedEvents } from "@/features/featured-events/FeaturedEvents";
import { TodayStrip } from "@/features/today-strip/TodayStrip";
import { UpcomingEvents } from "@/features/upcoming-events/UpcomingEvents";
import { useSeoHead } from "@/lib/seo/useSeoHead";
import { buildHomeSeo } from "@/lib/seo/page-seo";

import styles from "./HomePage.module.css";

export function HomePage() {
  useSeoHead(buildHomeSeo());

  return (
    <div className={styles.page} data-testid="home-page">
      <div className={styles.desktopChrome}>
        <TopNav />
        <RainbowStripe variant="desktop" />
      </div>
      <MobileNav variant="home" />
      <RainbowStripe variant="mobile" />

      <main className={styles.main}>
        <Text variant="header1" tone="onPage" className={styles.pageTitle}>
          Events in Fresno &amp; the Central Valley
        </Text>
        <FeaturedEvents />
        <AdSlot variant="banner-wide" />
        <TodayStrip />
        <section className={styles.upcomingSection}>
          <UpcomingEvents />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
