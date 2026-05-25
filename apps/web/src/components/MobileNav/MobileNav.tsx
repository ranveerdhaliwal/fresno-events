import { Link } from "@tanstack/react-router";
import { Menu, Search } from "lucide-react";

import styles from "./MobileNav.module.css";

export type MobileNavVariant = "home" | "day" | "event";

export interface MobileNavProps {
  variant?: MobileNavVariant;
  title?: string;
}

export function MobileNav({ variant = "home", title }: MobileNavProps) {
  return (
    <header className={styles.nav} data-testid="mobile-nav">
      {variant === "home" ? (
        <>
          <button type="button" className={styles.iconBtn} aria-label="Menu">
            <Menu size={22} />
          </button>
          <Link to="/" className={styles.logoCenter}>
            <img src="/brand/nav-mark.svg" alt="What Up Fresno" height={40} />
          </Link>
          <button type="button" className={styles.signIn}>
            SIGN IN
          </button>
        </>
      ) : variant === "day" ? (
        <>
          <Link to="/" className={styles.iconBtn} aria-label="Back">
            ←
          </Link>
          <span className={styles.title}>{title}</span>
          <button type="button" className={styles.iconBtn} aria-label="Search">
            <Search size={20} />
          </button>
        </>
      ) : (
        <>
          <Link to="/" className={styles.iconBtn} aria-label="Back">
            ←
          </Link>
          <span className={styles.title}>EVENT DETAILS</span>
          <button type="button" className={styles.iconBtn} aria-label="Share">
            ↗
          </button>
        </>
      )}
    </header>
  );
}
