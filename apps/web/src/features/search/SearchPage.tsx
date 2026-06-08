import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { searchAll } from "@/services/search.service";

import styles from "./SearchPage.module.css";

export function SearchPage() {
  const navigate = useNavigate();
  const { q: urlQuery } = useSearch({ from: "/search" });
  const [draft, setDraft] = useState(urlQuery);

  useEffect(() => {
    setDraft(urlQuery);
  }, [urlQuery]);

  const trimmed = urlQuery.trim();
  const enabled = trimmed.length >= 2;

  const searchQuery = useQuery({
    queryKey: ["search", trimmed],
    queryFn: ({ signal }) => searchAll(trimmed, { signal }),
    enabled,
    staleTime: 1000 * 30
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = draft.trim();
    void navigate({ to: "/search", search: { q: next } });
  };

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Search</h1>
      <p className={styles.hint}>Internal dev tool — events, venues, and artists.</p>
      <form onSubmit={handleSubmit}>
        <input
          className={styles.input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search…"
          aria-label="Search query"
        />
      </form>

      {!enabled ? <p className={styles.hint}>Type at least 2 characters.</p> : null}
      {searchQuery.isLoading ? <p className={styles.hint}>Searching…</p> : null}
      {searchQuery.error ? <p className={styles.error}>{searchQuery.error.message}</p> : null}

      {searchQuery.data ? (
        <>
          <section className={styles.section}>
            <h2>Events ({searchQuery.data.events.length})</h2>
            <ul className={styles.list}>
              {searchQuery.data.events.map((item) => (
                <li key={item.event.id}>
                  <Link to="/event/$slug" params={{ slug: item.event.slug }} className={styles.link}>
                    <strong>{item.event.title}</strong>
                    <div className={styles.meta}>
                      {item.venue.name} · {new Date(item.event.startTs).toLocaleString()}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.section}>
            <h2>Venues ({searchQuery.data.venues.length})</h2>
            <ul className={styles.list}>
              {searchQuery.data.venues.map((venue) => (
                <li key={venue.id}>
                  <span className={styles.link}>
                    <strong>{venue.name}</strong>
                    <div className={styles.meta}>{venue.city}</div>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.section}>
            <h2>Artists ({searchQuery.data.artists.length})</h2>
            <ul className={styles.list}>
              {searchQuery.data.artists.map((artist) => (
                <li key={artist.id}>
                  <span className={styles.link}>
                    <strong>{artist.name}</strong>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  );
}
