import { RainbowStripe } from "@/components/RainbowStripe";
import { TopNav } from "@/components/TopNav";
import { MobileNav } from "@/components/MobileNav";
import { AdSlot } from "@/components/AdSlot";
import { SiteFooter } from "@/components/SiteFooter";
import { FeaturedEvents } from "@/features/featured-events/FeaturedEvents";
import { TodayStrip } from "@/features/today-strip/TodayStrip";
import { UpcomingEvents } from "@/features/upcoming-events/UpcomingEvents";

import styles from "./HomePage.module.css";

export function HomePage() {
  return (
    <div className={styles.page} data-testid="home-page">
      <div className={styles.desktopChrome}>
        <TopNav />
        <RainbowStripe variant="desktop" />
      </div>
      <MobileNav variant="home" />
      <RainbowStripe variant="mobile" />

      <main className={styles.main}>
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
