import { Text } from "@/components/Text";
import { cn } from "@/lib/cn";

import styles from "./EventTag.module.css";

export interface EventTagProps {
  children: string;
  className?: string | undefined;
}

/** Mustard chip used for public event tags (detail sidebar, upcoming preview). */
export function EventTag({ children, className }: EventTagProps) {
  return (
    <Text variant="caps" tone="onCard" as="span" className={cn(styles.tag, className)} data-testid="event-tag">
      {children}
    </Text>
  );
}
