import { gradientForPalette } from "@/lib/image-palette";
import { cn } from "@/lib/cn";

import type { PlaceholderImageProps } from "./PlaceholderImage.types";
import styles from "./PlaceholderImage.module.css";

export function PlaceholderImage({ paletteKey, label, className, imageUrl }: PlaceholderImageProps) {
  if (imageUrl) {
    return (
      <div className={cn(styles.root, className)}>
        <img src={imageUrl} alt="" className={styles.img} />
      </div>
    );
  }

  return (
    <div
      className={cn(styles.root, className)}
      style={{ background: gradientForPalette(paletteKey) }}
      data-testid="placeholder-image"
    >
      <span className={styles.label}>{label ?? paletteKey}</span>
    </div>
  );
}
