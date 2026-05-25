import { Link } from "@tanstack/react-router";

import type { PopularEventViewModel } from "@/lib/event-view-model";

import styles from "./PopularList.module.css";

export interface PopularListProps {
  title?: string;
  count?: number;
  events: PopularEventViewModel[];
}

export function PopularList({ title = "POPULAR RIGHT NOW", count, events }: PopularListProps) {
  return (
    <div className={styles.card} data-testid="popular-list">
      <div className={styles.head}>
        <h3>{title}</h3>
        {count !== undefined ? <span className={styles.badge}>{count}</span> : null}
      </div>
      <ul className={styles.list}>
        {events.map((event) => (
          <li key={event.id}>
            <Link to="/event/$slug" params={{ slug: event.slug }}>
              <span className={styles.rank}>{event.rank}</span>
              <span>
                <span className={styles.eventTitle}>{event.title}</span>
                <span className={styles.meta}>{event.meta}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
