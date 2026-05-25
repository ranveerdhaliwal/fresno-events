import type { ReactNode } from "react";

import { BottomTabBar } from "@/components/BottomTabBar";
import { MobileNav, type MobileNavProps } from "@/components/MobileNav";
import { RainbowStripe } from "@/components/RainbowStripe";
import { TopNav } from "@/components/TopNav";

import styles from "./PageChrome.module.css";

export interface PageChromeProps {
  children: ReactNode;
  mobileNav?: MobileNavProps;
  showBottomTabs?: boolean;
}

export function PageChrome({ children, mobileNav, showBottomTabs = false }: PageChromeProps) {
  return (
    <div className={styles.page}>
      <div className={styles.desktopChrome}>
        <TopNav />
        <RainbowStripe variant="desktop" />
      </div>
      {mobileNav ? <MobileNav {...mobileNav} /> : null}
      <RainbowStripe variant="mobile" />
      <main className={styles.main}>{children}</main>
      {showBottomTabs ? <BottomTabBar /> : null}
    </div>
  );
}
