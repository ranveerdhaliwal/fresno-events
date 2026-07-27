import type { ElementType, ReactNode } from "react";

import { Text } from "@/components/Text";
import { cn } from "@/lib/cn";

import styles from "./SectionTitle.module.css";

export type SectionTitleSize = "lg" | "md" | "sm";

export interface SectionTitleProps {
  as?: ElementType;
  script?: string;
  children: ReactNode;
  size?: SectionTitleSize;
  className?: string | undefined;
  titleClassName?: string | undefined;
}

const titleVariant = {
  lg: "header1",
  md: "header1",
  sm: "header2"
} as const;

export function SectionTitle({
  as: Component = "h2",
  script,
  children,
  size = "md",
  className,
  titleClassName
}: SectionTitleProps) {
  return (
    <Component className={cn(styles.root, styles[size], className)}>
      {script ? (
        <Text variant="script" tone="brand" scriptStyle="section" as="span" className={styles.script}>
          {script}
        </Text>
      ) : null}
      <Text
        variant={titleVariant[size]}
        tone="onPage"
        as="span"
        className={cn(styles.title, titleClassName)}
      >
        {children}
      </Text>
    </Component>
  );
}
