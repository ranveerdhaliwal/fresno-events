import type { ReactNode } from "react";

import { Text } from "@/components/Text";
import { cn } from "@/lib/cn";
import patternStyles from "@/styles/patterns.module.css";

export interface EmptyStateProps {
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
}

/** Centered placeholder message on a cream card — shared by list empty states. */
export function EmptyState({ children, className, ...rest }: EmptyStateProps) {
  return (
    <Text variant="body2" tone="mutedOnCard" className={cn(patternStyles.emptyOnCard, className)} {...rest}>
      {children}
    </Text>
  );
}
