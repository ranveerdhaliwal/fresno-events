import { Link } from "@tanstack/react-router";

import styles from "./TopNav.module.css";

const links = [
  { to: "/" as const, label: "EVENTS" },
  { to: "/explore" as const, label: "EXPLORE" },
  { to: "/map" as const, label: "MAP" },
  { to: "/saved" as const, label: "SAVED" }
];

export function TopNav() {
  return (
    <header className={styles.outer} data-testid="top-nav">
      <nav className={styles.nav}>
        <Link to="/" className={styles.logo}>
          <img src="/brand/nav-mark.svg" alt="What Up Fresno" width={178} height={56} />
        </Link>
        <div className={styles.links}>
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={styles.link}
              activeProps={{ className: styles.linkActive }}
              activeOptions={{ exact: link.to === "/" }}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className={styles.right}>
          <input type="search" className={styles.search} placeholder="Search events, venues…" aria-label="Search" />
          <button type="button" className={styles.signIn}>
            SIGN IN
          </button>
        </div>
      </nav>
    </header>
  );
}
