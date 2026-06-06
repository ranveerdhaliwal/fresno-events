import type { AiDiscoveryItem } from "@/ai";
import { isPlausibleEvent } from "@/ai/validation";
import type { IngestEnv } from "@/env";
import { getJsonPromptBackend } from "@/llm/registry";
import { fresnoSearchArea } from "@/sources";

export type ExtractorVariant = "default" | "festival" | "headline_only";

export interface ExtractMarkdownOptions {
  url: string;
  label: string;
  markdown: string;
  variant?: ExtractorVariant;
  dateRange?: { start: string; end: string };
}

function buildSystemPrompt(variant: ExtractorVariant, dateRange?: { start: string; end: string }): string {
  const dateClause = dateRange
    ? `Only return events with start dates between ${dateRange.start} and ${dateRange.end} inclusive.`
    : "Only return events within 50 miles of Fresno, California in the next 12 months.";

  const base = [
    "You extract upcoming public events from a single web page (markdown).",
    dateClause,
    "Return minified JSON with key `events`: array of { title, startTs, venueName, venueAddress?, venueCity?, category?, descriptionText?, ticketUrl?, externalUrl?, imageUrl?, priceMin?, priceMax? }.",
    "If a date is missing, omit the event. Never invent details.",
    "startTs must be ISO 8601 in UTC (Z). When the page shows local wall times (e.g. Pacific), convert to the correct UTC instant — do not copy clock digits as UTC.",
    "On single-venue listing pages, set venueName to the source label when rows do not name another venue."
  ];

  if (variant === "festival") {
    base.push(
      "For multi-day fairs: emit one event per fair day (distinct startTs per day). Put that day's performers or activities in descriptionText; do not create separate events per performer."
    );
  }

  if (variant === "headline_only") {
    base.push(
      "Only extract large featured headliner acts near the top of the page. Ignore DJ grids, weekly club nights, and small recurring listings at the bottom."
    );
  }

  return base.join(" ");
}

export async function extractEventsFromMarkdown(
  env: IngestEnv,
  args: ExtractMarkdownOptions
): Promise<AiDiscoveryItem[]> {
  const backend = getJsonPromptBackend(env, "discovery");
  if (!backend || args.markdown.length < 200) {
    return [];
  }

  const variant = args.variant ?? "default";
  const system = buildSystemPrompt(variant, args.dateRange);

  const user = [
    `Source label: ${args.label}`,
    `Default venueName for events on this page: "${args.label}" (unless a row clearly names another venue).`,
    `Source URL: ${args.url}`,
    `Search area: lat=${fresnoSearchArea.lat}, lng=${fresnoSearchArea.lng}, radius=${fresnoSearchArea.radiusMiles}mi`,
    "--- BEGIN MARKDOWN ---",
    args.markdown,
    "--- END MARKDOWN ---"
  ].join("\n");

  const result = await backend.generateJson<{ events?: AiDiscoveryItem[] }>({ system, user });
  return Array.isArray(result?.events) ? result.events.filter(isPlausibleEvent) : [];
}
