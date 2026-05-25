import { cn } from "@/lib/cn";

import styles from "./RainbowStripe.module.css";

export type RainbowStripeVariant = "desktop" | "mobile";

export interface RainbowStripeProps {
  variant?: RainbowStripeVariant;
  className?: string;
}

export function RainbowStripe({ variant = "desktop", className }: RainbowStripeProps) {
  return (
    <div
      className={cn(styles.stripe, variant === "mobile" && styles.mobile, className)}
      data-testid="rainbow-stripe"
      aria-hidden
    />
  );
}
