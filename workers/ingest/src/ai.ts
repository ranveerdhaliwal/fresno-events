import {
  eventCategories,
  formatEventDisplayPriorityRubric,
  resolveEventCategory,
  stripLeadingCalendarYear,
  type EventCategory,
  type NormalizedEvent
} from "@fresno-events/shared";

import { clampEnrichmentConfidence, clampSuggestedPriority } from "@/ai-enrichment.utils";
import type { IngestEnv } from "@/env";
import { getJsonPromptBackend } from "@/llm/registry";
import type { JsonPromptBackend, TextProviderRole } from "@/llm/types";
export interface AiEnrichment {
  confidence: number;
  category: EventCategory | null;
  cleaned_title: string | null;
  tags: string[];
  is_junk: boolean;
  reasoning: string;
  suggested_priority: number;
}

export interface AiDiscoveryItem {
  title: string;
  startTs?: string;
  venueName: string;
  venueAddress?: string;
  venueCity?: string;
  venueLat?: number;
  venueLng?: number;
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

  const priorityRubric = formatEventDisplayPriorityRubric();

  const system = [
    "You are a strict event-quality classifier for a community events app focused on Fresno, California.",
    "Score how likely a candidate is a real, public, in-person event near Fresno.",
    "Return only minified JSON with keys: confidence (0..1), category (one of the allowed values or null),",
    "cleaned_title (string or null), tags (array of short strings), is_junk (boolean), reasoning (short string),",
    "suggested_priority (integer 0..5).",
    "cleaned_title: when the source title appends venue/admission policy noise (age gates, 'under 18 must be accompanied',",
    "'21+', 'all ages', 'ID required', similar trailing parentheticals or disclaimers), return a cleaned show name without that noise.",
    "Also strip a leading calendar year when it is just season noise (e.g. '2026 NSA Southwest Nationals' → 'NSA Southwest Nationals',",
    "'2026 Summer Band Concerts…' → 'Summer Band Concerts…'). Keep years that are part of a proper name (e.g. 'Class of 2026').",
    "Keep artistic/tour parentheticals that are part of the act name (e.g. Acoustic, Live, tour nicknames).",
    "If the title is already clean, set cleaned_title to null.",
    `Display priority rubric (lower = more prominent in feed): ${priorityRubric}.`,
    "Priority is editorial prominence, not how much you like the event. Be conservative: most events are P4 or P5.",
    "P1 and P2 are rare and reserved — do NOT hand them out generously. When unsure, prefer 4 or 5, never round up.",
    "Calibration for Fresno:",
    "P1 = once-in-a-period citywide marquee draw (e.g. Ringling Bros at the arena, a stadium headliner everyone knows).",
    "P2 = arena/major shows and big touring names (Save Mart Center concerts, major comedians, marquee festivals).",
    "P3 = notable venue shows (Tower Theatre, Saroyan/Selland, Warnors, Big Fresno Fair concerts, Fresno Grizzlies games).",
    "P4 = bigger-than-usual local listing (club shows at Fulton 55 / Strummer's / Rainbow Ballroom, community runs/walks, zoo special events).",
    "P5 = routine recurring community listing (farmers markets, karaoke, trivia, open mic, bingo, wine walks, fitness-in-the-park, story time, scavenger hunts, meetups, workshops/classes/camps, away minor-league games).",
    "Never assign suggested_priority 0 unless the listing is clearly sponsored/ad content.",
    "Category calibration: touring/concert acts and named musical artists at performing-arts venues",
    "(Tower Theatre, Warnors, Saroyan/Selland, Save Mart Center, clubs) are category music — not community.",
    "Use community only for markets, meetups, workshops, trivia, karaoke, fitness, and similar routine listings.",
    "Use theater for plays/musicals/ballet/opera; comedy for stand-up; sports for games and races."
  ].join(" ");

  const user = [
    `Allowed event categories (pick one for category, or null): ${eventCategories.join(", ")}.`,
    `Event JSON: ${JSON.stringify({
      title: event.title,
      venueName: event.venueName,
      venueCity: event.venueCity,
      startTs: event.startTs,
      category: event.category,
      descriptionText: event.descriptionText,
      externalUrl: event.externalUrl,
      ticketUrl: event.ticketUrl
    })}`,
    "Mark is_junk=true for ads, gift cards, parking, livestream-only, NSFW, Shen Yun, or events more than 50 miles from Fresno."
  ].join("\n");

  const result = await backend.generateJson<Partial<AiEnrichment>>({ system, user });
  if (!result) {
    return null;
  }

  return normalizeEnrichment(result, event);
}

function normalizeEnrichment(input: Partial<AiEnrichment>, event: NormalizedEvent): AiEnrichment {
  const isJunk = Boolean(input.is_junk);
  const confidence = clampEnrichmentConfidence(input.confidence);
  const aiCategory =
    typeof input.category === "string" && eventCategories.includes(input.category as EventCategory)
      ? (input.category as EventCategory)
      : null;
  const aiCleaned =
    typeof input.cleaned_title === "string" && input.cleaned_title.trim().length > 0
      ? input.cleaned_title.trim()
      : null;
  const strippedSource = stripLeadingCalendarYear(event.title);
  const strippedAi = aiCleaned ? stripLeadingCalendarYear(aiCleaned) : null;
  const cleaned =
    strippedAi && strippedAi !== event.title.trim()
      ? strippedAi
      : strippedSource !== event.title.trim()
        ? strippedSource
        : null;
  const titleForCategory = cleaned ?? event.title;
  const category = resolveEventCategory({
    title: titleForCategory,
    venueName: event.venueName,
    ...(event.descriptionText ? { descriptionText: event.descriptionText } : {}),
    category: aiCategory ?? event.category ?? "community"
  });
  const tags = Array.isArray(input.tags) ? input.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 8) : [];
  const reasoning = typeof input.reasoning === "string" ? input.reasoning.slice(0, 240) : "";
  const suggested_priority = clampSuggestedPriority(input.suggested_priority, isJunk);

  return {
    confidence,
    category,
    cleaned_title: cleaned,
    tags,
    is_junk: isJunk,
    reasoning,
    suggested_priority
  };
}

