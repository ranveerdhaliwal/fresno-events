import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { EventRow } from "@/components/EventRow";
import { PageChrome } from "@/components/PageChrome";
import { UpcomingDetailPanel } from "@/features/upcoming-events/UpcomingDetailPanel";
import { toEventRowViewModel } from "@/lib/event-view-model";
import { searchAll } from "@/services/search.service";

import styles from "./SearchPage.module.css";

export function SearchPage() {
  const navigate = useNavigate();
  const { q: urlQuery } = useSearch({ from: "/search" });
  const [draft, setDraft] = useState(urlQuery);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const rows = useMemo(
    () => (searchQuery.data?.events ?? []).map((item) => toEventRowViewModel(item)),
    [searchQuery.data]
  );
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void navigate({ to: "/search", search: { q: draft.trim() } });
  };

  return (
    <PageChrome mobileNav={{ variant: "day", title: "SEARCH" }}>
      <main className={styles.page}>
        <h1 className={styles.title}>
          <span className={styles.script}>explore</span> EVENTS
        </h1>
        <form onSubmit={handleSubmit}>
          <input
            className={styles.input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search events, venues, artists…"
            aria-label="Search query"
          />
        </form>

        {!enabled ? <p className={styles.hint}>Type at least 2 characters.</p> : null}
        {searchQuery.isLoading ? <p className={styles.hint}>Searching…</p> : null}
        {searchQuery.error ? <p className={styles.error}>{searchQuery.error.message}</p> : null}

        {searchQuery.data ? (
          <div className={styles.split}>
            <div className={styles.listCol}>
              <section className={styles.section}>
                <h2>Events ({rows.length})</h2>
                <div className={styles.list}>
                  {rows.map((row) => (
                    <EventRow
                      key={row.id}
                      event={row}
                      isSelected={selected?.id === row.id}
                      onSelect={() => setSelectedId(row.id)}
                    />
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <h2>Venues ({searchQuery.data.venues.length})</h2>
                <ul className={styles.venueList}>
                  {searchQuery.data.venues.map((venue) => (
                    <li key={venue.id}>
                      <Link to="/venue/$slug" params={{ slug: venue.slug }} className={styles.venueLink}>
                        {venue.name} · {venue.city}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
            <UpcomingDetailPanel event={selected} />
          </div>
        ) : null}
      </main>
    </PageChrome>
  );
}
