import { PlaceholderImage } from "@/components/PlaceholderImage";
import { cn } from "@/lib/cn";

import styles from "./AdSlot.module.css";

export type AdSlotVariant = "banner-wide" | "banner-stacked" | "card" | "side";

export interface AdSlotProps {
  variant?: AdSlotVariant;
}

export function AdSlot({ variant = "banner-wide" }: AdSlotProps) {
  if (variant === "card") {
    return (
      <div className={styles.card} data-testid="ad-slot-card">
        <span className={styles.tag}>AD</span>
        <div className={styles.phImg}>
          <PlaceholderImage paletteKey="festival" label="LOCAL" />
        </div>
        <h4>Support local venues</h4>
        <p>Your ad could reach Fresno event-goers every week.</p>
        <span className={styles.ctaLink}>LEARN MORE</span>
      </div>
    );
  }

  if (variant === "side") {
    return (
      <div className={styles.side} data-testid="ad-slot-side">
        <span className={styles.tag}>AD</span>
        <p className={styles.sideTitle}>Local spotlight</p>
        <p className={styles.sideCopy}>Your business here — reach event-goers weekly.</p>
        <span className={styles.ctaLink}>LEARN MORE</span>
      </div>
    );
  }

  return (
    <div className={cn(styles.banner, variant === "banner-wide" && styles.wide, variant === "banner-stacked" && styles.stacked)} data-testid="ad-slot">
      <span className={styles.tag}>AD</span>
      <div className={styles.body}>
        <h4>Reach Fresno locals</h4>
        <p>Promote your business on What Up Fresno.</p>
      </div>
      <span className={styles.cta}>GET STARTED</span>
    </div>
  );
}
