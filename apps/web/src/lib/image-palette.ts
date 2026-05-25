export type ImagePaletteKey =
  | "music"
  | "food"
  | "arts"
  | "sports"
  | "outdoor"
  | "arts2"
  | "festival"
  | "history"
  | "music2"
  | "zoo";

export const IMAGE_PALETTES: Record<ImagePaletteKey, [string, string]> = {
  music: ["#6b3fa0", "#d94f3d"],
  food: ["#e8743c", "#f2c14e"],
  arts: ["#2e5266", "#7aa9c2"],
  sports: ["#375a77", "#6b8e4e"],
  outdoor: ["#6b8e4e", "#7aa9c2"],
  arts2: ["#3d2817", "#d94f3d"],
  festival: ["#d94f3d", "#f2c14e"],
  history: ["#3d2817", "#2e5266"],
  music2: ["#2e5266", "#6b3fa0"],
  zoo: ["#6b8e4e", "#e8743c"]
};

const CATEGORY_MAP: Record<string, ImagePaletteKey> = {
  music: "music",
  food_drink: "food",
  art: "arts",
  theater: "arts2",
  sports: "sports",
  outdoor: "outdoor",
  family: "outdoor",
  festival: "festival",
  community: "history",
  nightlife: "music2",
  other: "zoo"
};

export function paletteKeyForCategory(category: string, eventId: string): ImagePaletteKey {
  const base = CATEGORY_MAP[category] ?? "zoo";
  const alt = base === "music" ? "music2" : base === "arts" ? "arts2" : base;
  const hash = [...eventId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return hash % 2 === 0 ? base : alt;
}

export function gradientForPalette(key: ImagePaletteKey): string {
  const [a, b] = IMAGE_PALETTES[key];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}
