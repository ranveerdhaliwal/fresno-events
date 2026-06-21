import { Link } from "@tanstack/react-router";

import { PlaceholderImage } from "@/components/PlaceholderImage";
import { cn } from "@/lib/cn";
import { isListTicketPriceLabel } from "@/lib/event-price.utils";

import type { EventRowProps } from "./EventRow.types";
import styles from "./EventRow.module.css";

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
  const showRowImage =
    showImage &&
    (event.priority < 5 || event.showVenueLogoInList === true || showP5ListImage);
  const p5ListLayout =
    event.priority === 5 && showP5ListImage && event.showVenueLogoInList !== true;

  const className = cn(
    styles.row,
    forceVisible && styles.forceVisible,
    event.priority === 0 && styles.p0,
    event.priority === 1 && styles.p1,
    event.priority === 1 && event.showVenueLogoInList && styles.p1VenueLogo,
    event.priority === 2 && styles.p2,
    event.priority === 4 && styles.p4,
    event.priority === 5 && styles.p5,
    event.priority === 5 && event.showVenueLogoInList && styles.p5WithLogo,
    p5ListLayout && styles.p5ShowImage,
    isSelected && styles.selected,
    isLive && styles.live
  );

  const content = (
    <>
      {event.flagLabel ? (
        <span className={cn(styles.flag, isLive && styles.flagLive)}>
          {isLive && <span className={styles.liveDot} aria-hidden />}
          {event.flagLabel}
        </span>
      ) : null}
      <div className={styles.rowDate}>
        <span className={styles.day}>{event.dayShort}</span>
        <span className={styles.num}>{event.dayNum}</span>
        <span className={styles.month}>{event.monthShort}</span>
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
        <h4>{event.title}</h4>
        <div className={styles.rowMeta}>
          <span>{event.timeLabel}</span>
          <span>{event.venueName}</span>
        </div>
        <span className={styles.rowCat}>{event.categoryLabel}</span>
      </div>
      <div className={cn(styles.rowPrice, event.isFree && styles.priceFree)}>
        {adminAction ? (
          <div className={styles.rowAdminEdit}>
            {adminAction}
          </div>
        ) : null}
        {priorityLabel ? <small className={styles.rowPriority}>{priorityLabel}</small> : null}
        {event.priceLabel ? (
          <span className={cn(isListTicketPriceLabel(event.priceLabel) && styles.priceTicketHint)}>
            {event.priceLabel}
          </span>
        ) : null}
        {priceSubLabel ? <small>{priceSubLabel}</small> : null}
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
