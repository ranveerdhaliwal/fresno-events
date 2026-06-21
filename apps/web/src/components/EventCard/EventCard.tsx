import { Link } from "@tanstack/react-router";

import type { EventRowViewModel } from "@/lib/event-view-model";
import { cn } from "@/lib/cn";
import { isListTicketPriceLabel } from "@/lib/event-price.utils";

import styles from "./EventCard.module.css";

export interface EventCardProps {
  event: EventRowViewModel;
}

export function EventCard({ event }: EventCardProps) {
  return (
    <Link to="/event/$slug" params={{ slug: event.slug }} className={styles.card} data-testid={`event-card-${event.slug}`}>
      <div className={styles.date}>
        <span className={styles.dow}>{event.dayShort}</span>
        <span className={styles.dnum}>{event.dayNum}</span>
      </div>
      <div className={styles.body}>
        <h4>{event.title}</h4>
        <p className={styles.meta}>
          {event.timeLabel} · {event.venueName}
        </p>
        <div className={styles.bottom}>
          <span className={styles.cat}>{event.categoryLabel}</span>
          {event.priceLabel ? (
            <span
              className={cn(
                styles.price,
                event.isFree && styles.free,
                isListTicketPriceLabel(event.priceLabel) && styles.priceTicketHint
              )}
            >
              {event.priceLabel}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
