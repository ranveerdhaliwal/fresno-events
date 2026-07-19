import type { ReactNode } from "react";

import { HomeAtmosphere } from "@/components/HomeAtmosphere";
import { MobileNav, type MobileNavProps } from "@/components/MobileNav";
import { RainbowStripe } from "@/components/RainbowStripe";
import { SiteFooter } from "@/components/SiteFooter";
import { TopNav } from "@/components/TopNav";

import styles from "./PageChrome.module.css";

export interface PageChromeProps {
  children: ReactNode;
  mobileNav?: MobileNavProps;
}

export function PageChrome({ children, mobileNav }: PageChromeProps) {
  return (
    <div className={styles.page}>
      <HomeAtmosphere />
      <div className={styles.chrome}>
        <div className={styles.desktopChrome}>
          <TopNav />
          <RainbowStripe variant="desktop" />
        </div>
        {mobileNav ? <MobileNav {...mobileNav} /> : null}
        <RainbowStripe variant="mobile" />
        <main className={styles.main}>{children}</main>
        <SiteFooter />
      </div>
    </div>
  );
}
