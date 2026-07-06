import { cn } from "@/lib/cn";

import { Text } from "@/components/Text";

import styles from "./FilterChip.module.css";

export interface FilterChipProps {
  active?: boolean;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}

export function FilterChip({
  active = false,
  children,
  className,
  onClick,
  type = "button"
}: FilterChipProps) {
  return (
    <button
      type={type}
      className={cn(styles.chip, active && styles.chipActive, className)}
      onClick={onClick}
    >
      <Text variant="eyebrow" tone={active ? "inverse" : "onCard"} as="span" className={styles.label}>
        {children}
      </Text>
    </button>
  );
}
