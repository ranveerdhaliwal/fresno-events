import { Link } from "@tanstack/react-router";

import styles from "./BottomTabBar.module.css";

const tabs = [
  { id: "events", label: "Events", to: "/" as const, active: true },
  { id: "places", label: "Places", to: "/explore" as const },
  { id: "food", label: "Food", to: "/explore" as const },
  { id: "saved", label: "Saved", to: "/saved" as const },
  { id: "me", label: "Me", to: "/settings" as const }
];

export function BottomTabBar() {
  return (
    <nav className={styles.bar} data-testid="bottom-tab-bar" aria-label="Primary">
      {tabs.map((tab) =>
        tab.active ? (
          <Link key={tab.id} to={tab.to} className={styles.tabActive}>
            {tab.label}
          </Link>
        ) : (
          <span key={tab.id} className={styles.tab}>
            {tab.label}
          </span>
        )
      )}
    </nav>
  );
}
