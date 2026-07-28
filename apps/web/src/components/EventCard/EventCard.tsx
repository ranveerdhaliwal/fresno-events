import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";

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
  const whenLine = `${event.timeLabel} - ${event.dayShort} ${event.dayNum}`.trim();

  const titleNode = onSelect ? (
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
  );

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
        <div className={styles.mainBlock}>
          <div className={styles.topRow}>{titleNode}</div>
          <Text variant="body3" tone="labelOnCard" weight="medium" as="p" className={styles.when}>
            {whenLine}
          </Text>
          <div className={styles.venueRow}>
            <MapPin className={styles.pin} size={13} strokeWidth={2.25} aria-hidden />
            <Text variant="body3" tone="labelOnCard" weight="semibold" as="span" className={styles.venue}>
              {event.venueName}
            </Text>
          </div>
        </div>
        <div className={styles.footerRow}>
          <Text variant="caps" tone="onCard" as="span" className={styles.cat}>
            {event.categoryLabel}
          </Text>
          {event.priceLabel ? (
            <Text
              variant="price"
              tone={event.isFree ? "label" : "accent"}
              weight="regular"
              as="span"
              className={cn(styles.price, event.isFree && styles.free, ticketHint && styles.priceTicketHint)}
            >
              {event.priceLabel}
            </Text>
          ) : null}
        </div>
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
