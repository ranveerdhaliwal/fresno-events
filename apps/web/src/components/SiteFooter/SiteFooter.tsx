import { Link } from "@tanstack/react-router";

import { RainbowStripe } from "@/components/RainbowStripe";
import { Text } from "@/components/Text";

import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <div className={styles.wrap} data-testid="site-footer">
      <RainbowStripe />
      <footer className={styles.footer}>
        <div className={styles.inner}>
          <div className={styles.brandBlock}>
            <Text variant="header2" tone="onPage" as="p" className={styles.brand}>
              What Up Fresno
            </Text>
            <Text variant="body2" tone="mutedOnPage" as="p" className={styles.tagline}>
              Fresno &amp; Central Valley events
            </Text>
            <Text variant="script" tone="brand" scriptStyle="footer" as="p" className={styles.script}>
              greetings from the central valley
            </Text>
          </div>

          <nav className={styles.links} aria-label="Site">
            <Link to="/privacy" className={styles.link}>
              <Text variant="eyebrow" tone="inherit" as="span">
                Privacy Policy
              </Text>
            </Link>
          </nav>

          <div className={styles.social} aria-label="Social links">
            <Text variant="eyebrow" tone="mutedOnPage" as="p" className={styles.socialLabel}>
              Follow us
            </Text>
            <Text variant="body2" tone="mutedOnPage" as="p" className={styles.socialPlaceholder}>
              Social links coming soon
            </Text>
          </div>
        </div>

        <Text variant="body3" tone="mutedOnPage" as="p" className={styles.copy}>
          &copy; {year} What Up Fresno
        </Text>
      </footer>
    </div>
  );
}
