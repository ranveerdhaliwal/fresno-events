import type { ElementType, ReactNode } from "react";

import { Text } from "@/components/Text";
import { capitalizeScriptPhrase } from "@/lib/section-script.utils";
import { cn } from "@/lib/cn";

import styles from "./SectionTitle.module.css";

export type SectionTitleSize = "lg" | "md" | "sm";

/** How the script word joins the block title. */
export type SectionTitleScriptJoin = "hyphen" | "tight";

export interface SectionTitleProps {
  as?: ElementType;
  script?: string;
  children: ReactNode;
  size?: SectionTitleSize;
  /**
   * `hyphen` — "What's - HAPPENING" (default for dual-font section heads).
   * `tight` — adjacent words without a dash (e.g. search EVENTS).
   */
  scriptJoin?: SectionTitleScriptJoin;
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
  scriptJoin = "hyphen",
  className,
  titleClassName
}: SectionTitleProps) {
  const scriptLabel = script ? capitalizeScriptPhrase(script) : null;

  return (
    <Component className={cn(styles.root, styles[size], className)}>
      {scriptLabel ? (
        <Text
          variant="script"
          tone="brand"
          scriptStyle="section"
          stroke="onDark"
          as="span"
          className={cn(styles.script, scriptJoin === "tight" && styles.scriptTight)}
        >
          {scriptLabel}
        </Text>
      ) : null}
      {scriptLabel && scriptJoin === "hyphen" ? (
        <Text variant="header1" tone="onPage" stroke="onDark" as="span" className={styles.join}>
          -
        </Text>
      ) : null}
      <Text
        variant={titleVariant[size]}
        tone="onPage"
        stroke="onDark"
        as="span"
        className={cn(styles.title, titleClassName)}
      >
        {children}
      </Text>
    </Component>
  );
}
