import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";

import { PlaceholderImage } from "@/components/PlaceholderImage";
import type { EventRowViewModel } from "@/lib/event-view-model";

import styles from "./UpcomingDetailPanel.module.css";

export interface UpcomingDetailPanelProps {
  event: EventRowViewModel | null;
}

export function UpcomingDetailPanel({ event }: UpcomingDetailPanelProps) {
  if (!event) {
    return (
      <div className={styles.panel} data-testid="upcoming-detail-empty">
        <div className={styles.empty}>
          <span className={styles.emptyScript}>pick one!</span>
          <h3>SELECT AN EVENT</h3>
          <p>Click any row on the left to preview details here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.panel} data-testid="upcoming-detail-panel">
      <div className={styles.hero}>
        <PlaceholderImage paletteKey={event.paletteKey} label={event.categoryLabel} imageUrl={event.imageUrl} />
        <div className={styles.badges}>
          {event.flagLabel ? <span className={styles.badge}>{event.flagLabel}</span> : null}
          <span className={styles.badgeCat}>{event.categoryLabel}</span>
        </div>
        <button type="button" className={styles.saveBtn} aria-label="Save event">
          <Heart size={18} />
        </button>
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>
          <Link to="/event/$slug" params={{ slug: event.slug }}>
            {event.title}
          </Link>
        </h3>
        <p className={styles.tagline}>{event.tagline}</p>
        <dl className={styles.facts}>
          <div>
            <dt>When</dt>
            <dd>
              {event.dateLabel} · {event.timeLabel}
            </dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>
              {event.venueName} · {event.neighborhood}
            </dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>{event.priceLabel}</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          <Link to="/event/$slug" params={{ slug: event.slug }} className={styles.rsvp}>
            RSVP / DETAILS
          </Link>
          <button type="button" className={styles.save}>
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
}
