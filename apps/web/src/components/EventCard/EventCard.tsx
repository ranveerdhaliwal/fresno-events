import { Link } from "@tanstack/react-router";

import { PlaceholderImage } from "@/components/PlaceholderImage";
import { Text } from "@/components/Text";
import type { EventRowViewModel } from "@/lib/event-view-model";
import { cn } from "@/lib/cn";
import { isListTicketPriceLabel } from "@/lib/event-price.utils";
import { heroImageFit, heroImagePadding } from "@/lib/hero-image.utils";
import endedStyles from "@/styles/ended-event.module.css";

import styles from "./EventCard.module.css";

export interface EventCardProps {
  event: EventRowViewModel;
  /** When set, the card selects (e.g. map zoom) instead of only navigating. Title remains a detail link. */
  onSelect?: (id: string, slug: string) => void;
  isSelected?: boolean;
}

export function EventCard({ event, onSelect, isSelected = false }: EventCardProps) {
  const past = event.timeStatus === "past";
  const showEnded = past || event.flagLabel === "ENDED";
  const imagePadding = heroImagePadding(event.imageUrl);
  const ticketHint = event.priceLabel != null && isListTicketPriceLabel(event.priceLabel);

  const body = (
    <>
      {showEnded ? (
        <Text variant="eyebrow" tone="onCard" as="span" className={endedStyles.cardFlag}>
          ENDED
        </Text>
      ) : null}
      <div className={styles.thumb} data-testid={`event-card-thumb-${event.slug}`}>
        <PlaceholderImage
          paletteKey={event.paletteKey}
          label={event.categoryLabel}
          imageUrl={event.imageUrl}
          imageFit={heroImageFit(event.imageUrl)}
          {...(imagePadding !== undefined ? { imagePadding } : {})}
        />
      </div>
      <div className={styles.body}>
        <div className={styles.headerRow}>
          {onSelect ? (
            <Text variant="header3" tone="onCard" weight="regular" as="span" className={styles.title}>
              <Link
                to="/event/$slug"
                params={{ slug: event.slug }}
                className={styles.titleLink}
                onClick={(eventClick) => eventClick.stopPropagation()}
              >
                {event.title}
              </Link>
            </Text>
          ) : (
            <Text variant="header3" tone="onCard" weight="regular" as="span" className={styles.title}>
              {event.title}
            </Text>
          )}
          {event.priceLabel ? (
            <Text
              variant="price"
              tone={event.isFree ? "label" : "accent"}
              weight="regular"
              as="span"
              className={cn(styles.price, event.isFree && styles.free, ticketHint && styles.priceTicketHint)}
            >
              {ticketHint ? (
                <>
                  See Tickets
                  <br />
                  for price
                </>
              ) : (
                event.priceLabel
              )}
            </Text>
          ) : null}
        </div>
        <Text variant="body3" tone="mutedOnCard" as="p" className={styles.meta}>
          {event.dayShort} {event.dayNum} · {event.timeLabel} · {event.venueName}
        </Text>
        <Text variant="body2" tone="labelOnCard" weight="medium" as="span" className={styles.cat}>
          {event.categoryLabel}
        </Text>
      </div>
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        className={cn(
          styles.card,
          styles.selectable,
          showEnded && endedStyles.cardPast,
          event.isLive && styles.live,
          isSelected && styles.selected
        )}
        data-testid={`event-card-${event.slug}`}
        onClick={() => onSelect(event.id, event.slug)}
      >
        {body}
      </button>
    );
  }

  return (
    <Link
      to="/event/$slug"
      params={{ slug: event.slug }}
      className={cn(styles.card, showEnded && endedStyles.cardPast, event.isLive && styles.live)}
      data-testid={`event-card-${event.slug}`}
    >
      {body}
    </Link>
  );
}
