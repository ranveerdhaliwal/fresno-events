import { Link } from "@tanstack/react-router";

import { PlaceholderImage } from "@/components/PlaceholderImage";
import type { FeatureCardViewModel } from "@/lib/event-view-model";
import { cn } from "@/lib/cn";

import styles from "./FeatureCard.module.css";

export interface FeatureCardProps {
  card: FeatureCardViewModel;
  variant?: "hero" | "small";
}

export function FeatureCard({ card, variant = "small" }: FeatureCardProps) {
  return (
    <Link
      to="/event/$slug"
      params={{ slug: card.slug }}
      className={cn(styles.card, variant === "hero" && styles.hero)}
      data-testid={`feature-card-${card.slug}`}
    >
      <div className={styles.image}>
        <PlaceholderImage paletteKey={card.paletteKey} label={card.categoryLabel} imageUrl={card.imageUrl} />
        {card.badge !== "default" ? (
          <span className={cn(styles.badge, styles[card.badge])}>{card.badge === "huge" ? "HUGE" : card.badge.toUpperCase()}</span>
        ) : null}
        <span className={styles.pillCat}>{card.categoryLabel}</span>
      </div>
      <div className={styles.body}>
        <h3>{card.title}</h3>
        <div className={styles.meta}>
          <span>{card.timeLabel}</span>
          <span>{card.venueName}</span>
        </div>
        {variant === "hero" && card.description ? <p className={styles.desc}>{card.description}</p> : null}
        <div className={styles.priceRow}>
          {card.priceLabel ? (
            <span className={cn(styles.price, card.isFree && styles.free)}>{card.priceLabel}</span>
          ) : null}
          <span className={styles.source}>via What Up Fresno</span>
        </div>
      </div>
    </Link>
  );
}
