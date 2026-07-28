import { cn } from "@/lib/cn";

import type { ButtonSize, ButtonVariant } from "./Button.types";
import styles from "./Button.module.css";

const variantClass = {
  approve: styles.approve ?? "",
  reject: styles.reject ?? "",
  secondary: styles.secondary ?? "",
  secondaryActive: styles.secondaryActive ?? "",
  ghost: styles.ghost ?? "",
  cta: styles.cta ?? "",
  mustard: styles.mustard ?? ""
} satisfies Record<ButtonVariant, string>;

const sizeClass = {
  xs: styles.xs ?? "",
  sm: styles.sm ?? "",
  md: styles.md ?? ""
} satisfies Record<ButtonSize, string>;

export function buttonClasses(variant: ButtonVariant, size: ButtonSize, className?: string): string {
  return cn(styles.base, variantClass[variant], sizeClass[size], className);
}

export type ButtonRenderKind = "router-link" | "anchor" | "button";

export function resolveButtonRenderKind(props: {
  to?: unknown;
  href?: string | undefined;
}): ButtonRenderKind {
  if (props.to != null) {
    return "router-link";
  }
  if (typeof props.href === "string") {
    return "anchor";
  }
  return "button";
}

export function defaultButtonVariant(kind: ButtonRenderKind): ButtonVariant {
  return kind === "router-link" ? "cta" : "secondary";
}
