import type { EventCategory, NormalizedEvent } from "@fresno-events/shared";

import type { IngestEnv } from "@/env";
import { getJsonPromptBackend } from "@/llm/registry";
import type { JsonPromptBackend, TextProviderRole } from "@/llm/types";
import { fresnoSearchArea } from "@/sources";

const VALID_CATEGORIES: EventCategory[] = [
  "music",
  "comedy",
  "theater",
  "sports",
  "food_drink",
  "festival",
  "family",
  "art",
  "nightlife",
  "community",
  "outdoor",
  "wellness",
  "education",
];

export interface AiEnrichment {
  confidence: number;
  category: EventCategory | null;
  cleaned_title: string | null;
  tags: string[];
  is_junk: boolean;
  reasoning: string;
}

export interface AiDiscoveryItem {
  title: string;
  startTs: string;
  venueName: string;
  venueAddress?: string;
  venueCity?: string;
  category?: string;
  descriptionText?: string;
  ticketUrl?: string;
  externalUrl?: string;
  imageUrl?: string;
  priceMin?: number;
  priceMax?: number;
}

export type AiBackend = JsonPromptBackend;

export function getAiBackend(env: IngestEnv, role?: TextProviderRole): AiBackend | null {
  return getJsonPromptBackend(env, role);
}

export async function enrichCandidate(env: IngestEnv, event: NormalizedEvent): Promise<AiEnrichment | null> {
  const backend = getJsonPromptBackend(env, "enrichment");
  if (!backend) {
    return null;
  }

  const system = [
    "You are a strict event-quality classifier for a community events app focused on Fresno, California.",
    "Score how likely a candidate is a real, public, in-person event near Fresno.",
    "Return only minified JSON with keys: confidence (0..1), category (one of the allowed values or null),",
    "cleaned_title (string or null), tags (array of short strings), is_junk (boolean), reasoning (short string).",
  ].join(" ");

  const user = [
    `Allowed categories: ${VALID_CATEGORIES.join(", ")}.`,
    `Event JSON: ${JSON.stringify({
      title: event.title,
      venueName: event.venueName,
      venueCity: event.venueCity,
      startTs: event.startTs,
      category: event.category,
      descriptionText: event.descriptionText,
      externalUrl: event.externalUrl,
    })}`,
    "Mark is_junk=true for ads, gift cards, parking, livestream-only, NSFW, or events more than 50 miles from Fresno.",
  ].join("\n");

  const result = await backend.generateJson<Partial<AiEnrichment>>({ system, user });
  if (!result) {
    return null;
  }

  return normalizeEnrichment(result);
}

export async function discoverEventsFromHtml(
  env: IngestEnv,
  args: { url: string; html: string; label: string },
): Promise<AiDiscoveryItem[]> {
  const backend = getJsonPromptBackend(env, "discovery");
  if (!backend) {
    return [];
  }

  const cleaned = stripHtml(args.html).slice(0, 24_000);
  if (cleaned.length < 200) {
    return [];
  }

  const system = [
    "You extract upcoming public events from a single web page.",
    "Only return events happening within 50 miles of Fresno, California in the next 90 days.",
    "Return minified JSON with key `events`: an array of objects with the keys",
    "title (string), startTs (ISO 8601), venueName (string), venueAddress (string, optional), venueCity (string, optional),",
    "category (one of music, comedy, theater, sports, food_drink, festival, family, art, nightlife, community, outdoor, wellness, education), descriptionText (string, optional),",
    "ticketUrl (string, optional), externalUrl (string, optional), imageUrl (string, optional), priceMin (number, optional), priceMax (number, optional).",
    "If a date is missing, omit the event. Never invent details.",
  ].join(" ");

  const user = [
    `Source label: ${args.label}`,
    `Source URL: ${args.url}`,
    `Search area: lat=${fresnoSearchArea.lat}, lng=${fresnoSearchArea.lng}, radius=${fresnoSearchArea.radiusMiles}mi`,
    "Page text follows between the markers --- BEGIN --- and --- END ---.",
    "--- BEGIN ---",
    cleaned,
    "--- END ---",
  ].join("\n");

  const result = await backend.generateJson<{ events?: AiDiscoveryItem[] }>({ system, user });
  return Array.isArray(result?.events) ? result.events.filter(isPlausibleEvent) : [];
}

function normalizeEnrichment(input: Partial<AiEnrichment>): AiEnrichment {
  const confidence = clamp(typeof input.confidence === "number" ? input.confidence : 0.5, 0, 1);
  const category =
    typeof input.category === "string" && VALID_CATEGORIES.includes(input.category as EventCategory)
      ? (input.category as EventCategory)
      : null;
  const tags = Array.isArray(input.tags) ? input.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 8) : [];
  const cleaned = typeof input.cleaned_title === "string" && input.cleaned_title.trim().length > 0 ? input.cleaned_title.trim() : null;
  const isJunk = Boolean(input.is_junk);
  const reasoning = typeof input.reasoning === "string" ? input.reasoning.slice(0, 240) : "";

  return { confidence, category, cleaned_title: cleaned, tags, is_junk: isJunk, reasoning };
}

function isPlausibleEvent(value: unknown): value is AiDiscoveryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as AiDiscoveryItem;
  return typeof item.title === "string" && typeof item.startTs === "string" && typeof item.venueName === "string";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
