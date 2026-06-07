import { Link } from "@tanstack/react-router";

import { PlaceholderImage } from "@/components/PlaceholderImage";
import { AdminEditLink } from "@/features/admin-mode/AdminEditLink";
import { cn } from "@/lib/cn";

import type { EventRowProps } from "./EventRow.types";
import styles from "./EventRow.module.css";

export function EventRow({
  event,
  isSelected,
  isLive,
  onSelect,
  slug,
  showImage = true,
  priceSubLabel,
  priorityLabel,
  forceVisible = false
}: EventRowProps) {
  const showRowImage =
    showImage && (event.priority < 5 || event.showVenueLogoInList === true);

  const className = cn(
    styles.row,
    forceVisible && styles.forceVisible,
    event.priority === 0 && styles.p0,
    event.priority === 1 && styles.p1,
    event.priority === 2 && styles.p2,
    event.priority === 3 && styles.p3,
    event.priority === 4 && styles.p4,
    event.priority === 5 && styles.p5,
    event.priority === 5 && event.showVenueLogoInList && styles.p5WithLogo,
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
      {showRowImage ? (
        <div className={styles.rowImg}>
          <PlaceholderImage
            paletteKey={event.paletteKey}
            label={event.categoryLabel}
            imageUrl={event.imageUrl}
            imageFit={event.showVenueLogoInList ? "contain" : "cover"}
            imagePadding={event.listVenueLogoPadding}
          />
        </div>
      ) : null}
      <div className={styles.rowDate}>
        <span className={styles.day}>{event.dayShort}</span>
        <span className={styles.num}>{event.dayNum}</span>
        <span className={styles.month}>{event.monthShort}</span>
      </div>
      <div className={styles.rowBody}>
        <h4>{event.title}</h4>
        <div className={styles.rowMeta}>
          <span>{event.timeLabel}</span>
          <span>{event.venueName}</span>
        </div>
        <span className={styles.rowCat}>{event.categoryLabel}</span>
      </div>
      <div className={cn(styles.rowPrice, event.isFree && styles.priceFree)}>
        {priorityLabel ? <small className={styles.rowPriority}>{priorityLabel}</small> : null}
        {event.priceLabel}
        {priceSubLabel ? (
          <small>{priceSubLabel}</small>
        ) : event.priority <= 1 ? (
          <small>RSVP</small>
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
        <AdminEditLink eventId={event.id} className={styles.adminEdit} />
      </div>
    );
  }

  return (
    <div className={styles.rowWrap}>
      <button type="button" className={className} onClick={onSelect} data-testid={`event-row-${event.slug}`}>
        {content}
      </button>
      <AdminEditLink eventId={event.id} className={styles.adminEdit} />
    </div>
  );
}
