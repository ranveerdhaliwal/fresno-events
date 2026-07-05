import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Text } from "@/components/Text";
import type { PopularEventViewModel } from "@/lib/event-view-model";

import styles from "./PopularList.module.css";

export interface PopularListProps {
  title?: string;
  count?: number;
  events: PopularEventViewModel[];
  renderAdminEdit?: (eventId: string) => ReactNode;
}

export function PopularList({ title = "POPULAR RIGHT NOW", count, events, renderAdminEdit }: PopularListProps) {
  return (
    <div className={styles.card} data-testid="popular-list">
      <div className={styles.head}>
        <Text variant="eyebrow" tone="onNav" as="h3" className={styles.headTitle}>
          {title}
        </Text>
        {count !== undefined ? (
          <Text variant="body3" tone="onCard" as="span" className={styles.badge}>
            {count}
          </Text>
        ) : null}
      </div>
      <ul className={styles.list}>
        {events.map((event) => (
          <li key={event.id}>
            <Link to="/event/$slug" params={{ slug: event.slug }}>
              <Text variant="price" tone="accent" as="span" className={styles.rank}>
                {event.rank}
              </Text>
              <span>
                <Text variant="body2" tone="onCard" as="span" className={styles.eventTitle}>
                  {event.title}
                </Text>
                <Text variant="body3" tone="labelOnCard" as="span" className={styles.meta}>
                  {event.meta}
                </Text>
              </span>
            </Link>
            {renderAdminEdit ? <div className={styles.adminEdit}>{renderAdminEdit(event.id)}</div> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
