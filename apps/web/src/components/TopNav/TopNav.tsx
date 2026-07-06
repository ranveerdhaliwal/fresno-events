import { Link } from "@tanstack/react-router";

import { AirQualityChip } from "@/components/AirQualityChip";
import { Text } from "@/components/Text";
import { WeatherChip } from "@/components/WeatherChip";

import styles from "./TopNav.module.css";

const links = [
  { to: "/" as const, label: "EVENTS" },
  { to: "/search" as const, label: "SEARCH", search: { q: "" } },
  { to: "/map" as const, label: "MAP" }
];

export function TopNav() {
  return (
    <header className={styles.outer} data-testid="top-nav">
      <nav className={styles.nav}>
        <Link to="/" className={styles.logo}>
          <img src="/brand/fresno-logo.png" alt="What Up Fresno" width={200} height={56} />
        </Link>
        <div className={styles.links}>
          {links.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              {...("search" in link ? { search: link.search } : {})}
              className={styles.link}
              activeProps={{ className: styles.linkActive }}
              activeOptions={{ exact: link.to === "/" }}
            >
              <Text variant="navLabel" tone="inherit" as="span">
                {link.label}
              </Text>
            </Link>
          ))}
        </div>
        <div className={styles.right}>
          <div className={styles.contextChips}>
            <WeatherChip />
            <AirQualityChip />
          </div>
        </div>
      </nav>
    </header>
  );
}
