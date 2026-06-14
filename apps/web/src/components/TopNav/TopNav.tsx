import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { AirQualityChip } from "@/components/AirQualityChip";
import { WeatherChip } from "@/components/WeatherChip";

import styles from "./TopNav.module.css";

const links = [
  { to: "/" as const, label: "EVENTS" },
  { to: "/search" as const, label: "EXPLORE", search: { q: "" } },
  { to: "/map" as const, label: "MAP" },
  { to: "/saved" as const, label: "SAVED" }
];

export function TopNav() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    void navigate({ to: "/search", search: { q: query.trim() } });
  };

  return (
    <header className={styles.outer} data-testid="top-nav">
      <nav className={styles.nav}>
        <Link to="/" className={styles.logo}>
          <img src="/brand/nav-mark.svg" alt="What Up Fresno" width={178} height={56} />
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
              {link.label}
            </Link>
          ))}
        </div>
        <div className={styles.right}>
          <div className={styles.contextChips}>
            <WeatherChip />
            <AirQualityChip />
          </div>
          <form className={styles.searchForm} onSubmit={handleSearch}>
          <input
            type="search"
            className={styles.search}
            placeholder="Search events, venues…"
            aria-label="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          </form>
        </div>
      </nav>
    </header>
  );
}
