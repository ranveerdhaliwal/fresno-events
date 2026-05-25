import type { ImagePaletteKey } from "@/lib/image-palette";

export interface PlaceholderImageProps {
  paletteKey: ImagePaletteKey;
  label?: string;
  className?: string;
  imageUrl?: string | null;
}
