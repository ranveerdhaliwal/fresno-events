import type { ElementType } from "react";

import { cn } from "@/lib/cn";

import type { TextProps, TextTone, TextVariant } from "./Text.types";
import styles from "./Text.module.css";

const variantClass = {
  header1: styles.header1 ?? "",
  header2: styles.header2 ?? "",
  header3: styles.header3 ?? "",
  eyebrow: styles.eyebrow ?? "",
  body1: styles.body1 ?? "",
  body2: styles.body2 ?? "",
  body3: styles.body3 ?? "",
  script: styles.script ?? ""
} satisfies Record<TextVariant, string>;

const toneClass = {
  onPage: styles.toneOnPage ?? "",
  onCard: styles.toneOnCard ?? "",
  mutedOnPage: styles.toneMutedOnPage ?? "",
  mutedOnCard: styles.toneMutedOnCard ?? "",
  label: styles.toneLabel ?? "",
  labelOnCard: styles.toneLabelOnCard ?? "",
  inherit: styles.toneInherit ?? ""
} satisfies Record<TextTone, string>;

const defaultElement = {
  header1: "h1",
  header2: "h2",
  header3: "h3",
  eyebrow: "p",
  body1: "p",
  body2: "p",
  body3: "p",
  script: "span"
} satisfies Record<TextVariant, ElementType>;

const defaultTone = {
  header1: "onPage",
  header2: "onCard",
  header3: "onCard",
  eyebrow: "label",
  body1: "onPage",
  body2: "onPage",
  body3: "onPage",
  script: "inherit"
} satisfies Record<TextVariant, TextTone>;

export function Text({
  variant,
  tone,
  as,
  className,
  children,
  ...props
}: TextProps) {
  const Component = as ?? defaultElement[variant];
  const resolvedTone = tone ?? defaultTone[variant];

  return (
    <Component
      className={cn(variantClass[variant], toneClass[resolvedTone], className)}
      {...props}
    >
      {children}
    </Component>
  );
}
