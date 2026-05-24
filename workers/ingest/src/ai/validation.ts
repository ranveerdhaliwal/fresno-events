import type { AiDiscoveryItem } from "@/ai";

export function isPlausibleEvent(value: unknown): value is AiDiscoveryItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as AiDiscoveryItem;
  return typeof item.title === "string" && typeof item.startTs === "string" && typeof item.venueName === "string";
}
