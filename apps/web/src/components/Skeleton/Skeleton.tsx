import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";

import type { SkeletonProps } from "./Skeleton.types";
import styles from "./Skeleton.module.css";

function toCssSize(value: CSSProperties["width"]): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return typeof value === "number" ? `${value}px` : value;
}

export function Skeleton({
  visible = true,
  animate = true,
  width,
  height,
  radius,
  circle = false,
  className
}: SkeletonProps) {
  if (!visible) {
    return null;
  }

  const resolvedHeight = height ?? (circle ? width : undefined);
  const style = {
    "--skeleton-width": circle ? toCssSize(resolvedHeight) : toCssSize(width ?? "100%"),
    "--skeleton-height": toCssSize(resolvedHeight ?? height ?? "1rem"),
    "--skeleton-radius": circle ? "999px" : toCssSize(radius)
  } as CSSProperties;

  return (
    <span
      className={cn(styles.root, animate && styles.animate, className)}
      style={style}
      aria-hidden
      data-testid="skeleton"
    />
  );
}
