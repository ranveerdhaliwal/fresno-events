import { Link } from "@tanstack/react-router";

import { Text } from "@/components/Text";
import type { EventRowViewModel } from "@/lib/event-view-model";
import { cn } from "@/lib/cn";
import { isListTicketPriceLabel } from "@/lib/event-price.utils";
import endedStyles from "@/styles/ended-event.module.css";

import styles from "./EventCard.module.css";

export interface EventCardProps {
  event: EventRowViewModel;
}

export function EventCard({ event }: EventCardProps) {
  const past = event.timeStatus === "past";
  const showEnded = past || event.flagLabel === "ENDED";

  return (
    <Link
      to="/event/$slug"
      params={{ slug: event.slug }}
      className={cn(styles.card, showEnded && endedStyles.cardPast, event.isLive && styles.live)}
      data-testid={`event-card-${event.slug}`}
    >
      {showEnded ? (
        <Text variant="eyebrow" tone="onCard" as="span" className={endedStyles.cardFlag}>
          ENDED
        </Text>
      ) : null}
      <div className={styles.date}>
        <Text variant="eyebrow" tone="onCard" as="span" className={styles.dow}>
          {event.dayShort}
        </Text>
        <Text variant="header2" tone="onCard" as="span" className={styles.dnum}>
          {event.dayNum}
        </Text>
      </div>
      <div className={styles.body}>
        <Text variant="header3" tone="onCard" as="span">
          {event.title}
        </Text>
        <Text variant="body3" tone="mutedOnCard" as="p" className={styles.meta}>
          {event.timeLabel} · {event.venueName}
        </Text>
        <div className={styles.bottom}>
          <Text variant="eyebrow" tone="labelOnCard" as="span" className={styles.cat}>
            {event.categoryLabel}
          </Text>
          {event.priceLabel ? (
            <Text
              variant="price"
              tone={event.isFree ? "label" : "accent"}
              as="span"
              className={cn(
                styles.price,
                event.isFree && styles.free,
                isListTicketPriceLabel(event.priceLabel) && styles.priceTicketHint
              )}
            >
              {event.priceLabel}
            </Text>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
