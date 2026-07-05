import type { CSSProperties } from "react";

import { gradientForPalette } from "@/lib/image-palette";
import { cn } from "@/lib/cn";

import type { PlaceholderImageProps } from "./PlaceholderImage.types";
import styles from "./PlaceholderImage.module.css";

export function PlaceholderImage({
  paletteKey,
  label,
  className,
  imageUrl,
  alt = "",
  imageFit = "cover",
  imagePadding
}: PlaceholderImageProps) {
  if (imageUrl) {
    return (
      <div
        className={cn(styles.root, styles.photo, imageFit === "contain" && styles.contain, className)}
        style={
          imageFit === "contain" && imagePadding !== undefined
            ? ({ "--logo-inset": `${imagePadding}px` } as CSSProperties)
            : undefined
        }
      >
        <img src={imageUrl} alt={alt} className={styles.img} />
      </div>
    );
  }

  return (
    <div
      className={cn(styles.root, styles.placeholder, className)}
      style={{ background: gradientForPalette(paletteKey) }}
      data-testid="placeholder-image"
    >
      <span className={styles.label}>{label ?? paletteKey}</span>
    </div>
  );
}
