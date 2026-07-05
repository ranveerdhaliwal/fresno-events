import type { ImagePaletteKey } from "@/lib/image-palette";

export interface PlaceholderImageProps {
  paletteKey: ImagePaletteKey;
  label?: string;
  className?: string;
  imageUrl?: string | null;
  alt?: string;
  /** Thumbnails for logos/posters in rows; posters on cards use cover. */
  imageFit?: "cover" | "contain";
  /** Inset (px) when imageFit is contain; lower = larger logo. */
  imagePadding?: number;
}
