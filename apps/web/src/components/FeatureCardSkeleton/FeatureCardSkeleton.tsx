import { Skeleton } from "@/components/Skeleton";
import { cn } from "@/lib/cn";

import styles from "./FeatureCardSkeleton.module.css";

export interface FeatureCardSkeletonProps {
  variant?: "hero" | "small";
  className?: string;
}

export function FeatureCardSkeleton({ variant = "small", className }: FeatureCardSkeletonProps) {
  return (
    <div
      className={cn(styles.card, variant === "hero" && styles.hero, className)}
      data-testid={`feature-card-skeleton-${variant}`}
      aria-hidden
    >
      <Skeleton className={styles.image} height={variant === "hero" ? 230 : 170} radius={0} />
      <div className={styles.body}>
        <Skeleton height={variant === "hero" ? 24 : 18} width="88%" />
        <div className={styles.meta}>
          <Skeleton height={12} width={44} />
          <Skeleton height={12} width={40} />
          <Skeleton height={12} width="34%" />
        </div>
        {variant === "hero" ? <Skeleton height={14} width="100%" /> : null}
        <div className={styles.priceRow}>
          <Skeleton height={14} width="28%" />
          <Skeleton height={11} width="34%" />
        </div>
      </div>
    </div>
  );
}
