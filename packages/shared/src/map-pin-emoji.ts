export interface MapPinEmojiInput {
  category?: string;
  title?: string;
  tags?: string[];
  subcategories?: string[];
  /** Admin override: empty/undefined = auto; single space or "pin" = default map pin; emoji = use as pin */
  mapPinEmoji?: string | null;
}

const CATEGORY_EMOJI: Record<string, string> = {
  music: "🎵",
  comedy: "😂",
  theater: "🎭",
  food_drink: "🍽️",
  festival: "🎪",
  family: "👨‍👩‍👧",
  art: "🎨",
  nightlife: "🌙",
  community: "✨",
  outdoor: "🌲",
  wellness: "🧘",
  education: "📚"
};

/** Presets for admin map-pin emoji picker. */
export const MAP_PIN_EMOJI_PRESETS = [
  { label: "Auto (smart detect)", value: "" },
  { label: "Default pin (no emoji)", value: "pin" },
  { label: "Baseball", value: "⚾" },
  { label: "Basketball", value: "🏀" },
  { label: "Football", value: "🏈" },
  { label: "Soccer", value: "⚽" },
  { label: "Hockey", value: "🏒" },
  { label: "Music", value: "🎵" },
  { label: "Theater", value: "🎭" },
  { label: "Food & drink", value: "🍽️" },
  { label: "Festival", value: "🎪" },
  { label: "Fireworks", value: "🎆" },
  { label: "Family", value: "👨‍👩‍👧" }
] as const;

function haystack(input: MapPinEmojiInput): string {
  return [input.title ?? "", ...(input.tags ?? []), ...(input.subcategories ?? [])]
    .join(" ")
    .toLowerCase();
}

function matchSportsEmoji(text: string): string | null {
  if (/\b(baseball|softball|grizzlies|diamond|mlb|milb|home run)\b/.test(text)) {
    return "⚾";
  }
  if (/\b(basketball|hoops|nba)\b/.test(text)) {
    return "🏀";
  }
  if (/\b(football|gridiron|nfl)\b/.test(text)) {
    return "🏈";
  }
  if (/\b(hockey|nhl|ice rink)\b/.test(text)) {
    return "🏒";
  }
  if (/\b(soccer|fútbol|futbol|premier league)\b/.test(text)) {
    return "⚽";
  }
  return null;
}

function matchCategoryEmoji(input: MapPinEmojiInput): string | null {
  const text = haystack(input);
  const category = input.category;

  if (category === "sports") {
    return matchSportsEmoji(text);
  }

  if (category && category in CATEGORY_EMOJI) {
    return CATEGORY_EMOJI[category] ?? null;
  }

  return null;
}

/**
 * Resolve map pin display.
 * - `null` → use default Leaflet pin (no emoji)
 * - string → emoji HTML for divIcon
 */
export function resolveMapPinEmoji(input: MapPinEmojiInput): string | null {
  const override = input.mapPinEmoji?.trim();
  if (override) {
    if (override === "pin" || override === "—" || override === "-") {
      return null;
    }
    return override;
  }

  const sports = matchSportsEmoji(haystack(input));
  if (sports) {
    return sports;
  }

  return matchCategoryEmoji(input);
}
