import { eventCategories, type EventCategory } from "@fresno-events/shared";

const CATEGORY_EMOJI: Record<EventCategory, string> = {
  music: "🎵",
  comedy: "😂",
  theater: "🎭",
  sports: "⚽",
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

export function getCategoryEmoji(category: EventCategory | string | undefined): string {
  if (category && eventCategories.includes(category as EventCategory)) {
    return CATEGORY_EMOJI[category as EventCategory];
  }
  return "✨";
}
