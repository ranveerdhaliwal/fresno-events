import { Heart } from "lucide-react";

import styles from "./StickyCtaBar.module.css";

export interface StickyCtaBarProps {
  ticketUrl?: string | null;
}

export function StickyCtaBar({ ticketUrl }: StickyCtaBarProps) {
  return (
    <div className={styles.bar} data-testid="sticky-cta-bar">
      <button type="button" className={styles.save} aria-label="Save">
        <Heart size={20} />
      </button>
      {ticketUrl ? (
        <a href={ticketUrl} target="_blank" rel="noreferrer" className={styles.rsvp}>
          RSVP / TICKETS
        </a>
      ) : (
        <button type="button" className={styles.rsvp}>
          RSVP
        </button>
      )}
    </div>
  );
}
