import type { CSSProperties } from "react";

export interface SkeletonProps {
  /** When false, renders nothing. @default true */
  visible?: boolean;
  /** @default true */
  animate?: boolean;
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  radius?: CSSProperties["borderRadius"];
  /** Sets width and height equal to `height` with circular radius. */
  circle?: boolean;
  className?: string | undefined;
}
