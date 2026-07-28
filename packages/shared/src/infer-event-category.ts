import type { EventCategory } from "./event.types.js";

export interface InferEventCategoryInput {
  title: string;
  venueName?: string;
  descriptionText?: string;
  /** Used when no strong signal is found. */
  fallback?: EventCategory;
}

const SPORTS_RE =
  /\b(vs\.?|versus|game\b|match\b|tournament|boxing|mma|wrestling|combat fighting|baseball|softball|soccer|football|basketball|hockey|volleyball|race\b|5k|10k|marathon|triathlon)\b/i;

const COMEDY_RE = /\b(comedy|comedian|stand-?up|improv)\b/i;

const THEATER_RE =
  /\b(ballet|nutcracker|swan lake|opera|broadway|musical\b|shakespeare|play\b|theatre production|theater production|dramatic arts|doubtfire)\b/i;

const FAMILY_RE = /\b(bluey|pageant|miss california|story.?time|kids?\b|children'?s)\b/i;

const FESTIVAL_RE = /\b(festival|carnaval|carnival|(?:state|county|big fresno)\s+fair)\b/i;

const MUSIC_RE =
  /\b(concert|live in concert|in concert|tour\b|doors\b|showtime|album|orchestra|symphony|choir|mariachi|grupo|jazz|blues|bluegrass|gospel|hip-?hop|rap\b|punk|metal|country music|singer|songwriter|band\b|dj\b|open mic night)\b/i;

/** Performing-arts / club rooms where listings are usually concerts unless another genre wins. */
const MUSIC_VENUE_RE =
  /\b(tower theatre|tower theater|warnors|saroyan|selland|save mart center|strummer'?s?|fulton 55|rainbow ballroom|wild stage|van ness|the hive|yosemite falls)\b/i;

/** Routine community programs that can still land at music venues. */
const COMMUNITY_AT_VENUE_RE =
  /\b(trivia|bingo|karaoke|open mic|workshop|class\b|meetup|fundraiser|market|yoga|fitness)\b/i;

/**
 * Title / venue / description heuristics for EventCategory when scrapers default to community
 * or enrichment leaves a weak category.
 */
export function inferEventCategory(input: InferEventCategoryInput): EventCategory {
  const title = input.title.trim();
  if (!title) {
    return input.fallback ?? "community";
  }

  const blob = `${title}\n${input.descriptionText ?? ""}`.replace(/\s+/g, " ").trim();
  const venue = (input.venueName ?? "").replace(/\s+/g, " ").trim();

  if (FAMILY_RE.test(blob)) {
    return "family";
  }
  if (SPORTS_RE.test(blob)) {
    return "sports";
  }
  if (COMEDY_RE.test(blob)) {
    return "comedy";
  }
  if (THEATER_RE.test(blob)) {
    return "theater";
  }
  if (FESTIVAL_RE.test(blob)) {
    return "festival";
  }
  if (MUSIC_RE.test(blob)) {
    return "music";
  }

  if (MUSIC_VENUE_RE.test(venue) && !COMMUNITY_AT_VENUE_RE.test(blob)) {
    return "music";
  }

  return input.fallback ?? "community";
}

/**
 * Prefer an inferred category when the current value is missing or the generic community bucket.
 */
export function resolveEventCategory(input: InferEventCategoryInput & { category?: EventCategory | null }): EventCategory {
  const current = input.category ?? input.fallback ?? "community";
  const inferred = inferEventCategory({
    title: input.title,
    ...(input.venueName !== undefined ? { venueName: input.venueName } : {}),
    ...(input.descriptionText !== undefined ? { descriptionText: input.descriptionText } : {}),
    fallback: current
  });

  if (current === "community" && inferred !== "community") {
    return inferred;
  }
  return current;
}
