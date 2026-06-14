import { Link } from "@tanstack/react-router";

import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer} data-testid="site-footer">
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <p className={styles.brand}>What Up Fresno</p>
          <p className={styles.tagline}>Fresno &amp; Central Valley events</p>
          <p className={styles.script}>greetings from the central valley</p>
        </div>

        <nav className={styles.links} aria-label="Site">
          <Link to="/privacy" className={styles.link}>
            Privacy Policy
          </Link>
        </nav>

        <div className={styles.social} aria-label="Social links">
          <p className={styles.socialLabel}>Follow us</p>
          <p className={styles.socialPlaceholder}>Social links coming soon</p>
        </div>
      </div>

      <p className={styles.copy}>&copy; {year} What Up Fresno</p>
    </footer>
  );
}
