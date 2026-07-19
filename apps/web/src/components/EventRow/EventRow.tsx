import { Link } from "@tanstack/react-router";

import { PlaceholderImage } from "@/components/PlaceholderImage";
import { Text } from "@/components/Text";
import { cn } from "@/lib/cn";
import { isListTicketPriceLabel } from "@/lib/event-price.utils";

import type { EventRowProps } from "./EventRow.types";
import { getEventRowLayoutFlags, getEventRowModifiers } from "./EventRow.utils";
import styles from "./EventRow.module.css";
import endedStyles from "@/styles/ended-event.module.css";

export function EventRow({
  event,
  isSelected,
  isLive,
  onSelect,
  slug,
  showImage = true,
  showP5ListImage = false,
  priceSubLabel,
  priorityLabel,
  forceVisible = false,
  adminAction
}: EventRowProps) {
  const live = isLive ?? event.isLive;
  const past = event.timeStatus === "past";
  const { showRowImage } = getEventRowLayoutFlags({
    showImage,
    showP5ListImage,
    priority: event.priority,
    showVenueLogoInList: event.showVenueLogoInList
  });
  const modifiers = getEventRowModifiers({
    showImage,
    showP5ListImage,
    priority: event.priority,
    showVenueLogoInList: event.showVenueLogoInList,
    forceVisible,
    isSelected,
    isLive: live,
    isPast: past
  });

  const className = cn(
    styles.row,
    modifiers.forceVisible && styles.forceVisible,
    modifiers.p0 && styles.p0,
    modifiers.p1 && styles.p1,
    modifiers.p1VenueLogo && styles.p1VenueLogo,
    modifiers.p2 && styles.p2,
    modifiers.p4 && styles.p4,
    modifiers.p5 && styles.p5,
    modifiers.p5WithLogo && styles.p5WithLogo,
    modifiers.p5ShowImage && styles.p5ShowImage,
    modifiers.selected && styles.selected,
    modifiers.live && styles.live,
    modifiers.past && endedStyles.past
  );

  const content = (
    <>
      {event.flagLabel ? (
        <Text
          variant="eyebrow"
          tone={past ? "onCard" : "inverse"}
          as="span"
          className={cn(styles.flag, live && styles.flagLive, past && endedStyles.flag)}
        >
          {live && <span className={styles.liveDot} aria-hidden />}
          {event.flagLabel}
        </Text>
      ) : null}
      <div className={styles.rowDate}>
        <Text variant="eyebrow" tone="accent" as="span" className={styles.day}>
          {event.dayShort}
        </Text>
        <Text variant="header3" tone="onCard" as="span" className={styles.num}>
          {event.dayNum}
        </Text>
        <Text variant="body3" tone="mutedOnCard" as="span" className={styles.month}>
          {event.monthShort}
        </Text>
      </div>
      {showRowImage ? (
        <div className={styles.rowImg}>
          <PlaceholderImage
            paletteKey={event.paletteKey}
            label={event.categoryLabel}
            imageUrl={event.imageUrl}
            imageFit={event.showVenueLogoInList ? "contain" : "cover"}
            {...(event.listVenueLogoPadding !== undefined
              ? { imagePadding: event.listVenueLogoPadding }
              : {})}
          />
        </div>
      ) : null}
      <div className={styles.rowBody}>
        <Text variant="header3" tone="onCard" as="span" className={styles.rowTitle}>
          {event.title}
        </Text>
        <div className={styles.rowMeta}>
          <Text variant="body3" tone="mutedOnCard" as="span">
            {event.timeLabel}
          </Text>
          <Text variant="body3" tone="mutedOnCard" as="span">
            {event.venueName}
          </Text>
        </div>
        <Text variant="eyebrow" tone="labelOnCard" as="span" className={styles.rowCat}>
          {event.categoryLabel}
        </Text>
      </div>
      <div className={cn(styles.rowPrice, event.isFree && styles.priceFree)}>
        {adminAction ? (
          <div className={styles.rowAdminEdit}>
            {adminAction}
          </div>
        ) : null}
        {priorityLabel ? (
          <Text variant="body3" tone="mutedOnCard" as="small" className={styles.rowPriority}>
            {priorityLabel}
          </Text>
        ) : null}
        {event.priceLabel ? (
          <Text
            variant="price"
            tone="accent"
            as="span"
            className={cn(event.isFree && styles.priceFree, isListTicketPriceLabel(event.priceLabel) && styles.priceTicketHint)}
          >
            {event.priceLabel}
          </Text>
        ) : null}
        {priceSubLabel ? (
          <Text variant="body3" tone="mutedOnCard" as="small">
            {priceSubLabel}
          </Text>
        ) : null}
      </div>
    </>
  );

  if (!onSelect) {
    return (
      <div className={styles.rowWrap}>
        <Link
          to="/event/$slug"
          params={{ slug: slug ?? event.slug }}
          className={className}
          data-testid={`event-row-${event.slug}`}
        >
          {content}
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.rowWrap}>
      <button type="button" className={className} onClick={onSelect} data-testid={`event-row-${event.slug}`}>
        {content}
      </button>
    </div>
  );
}
