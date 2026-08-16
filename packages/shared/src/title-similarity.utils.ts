import { canonicalOccurrenceTitle, normalizeTitle, normalizeVenue, pacificDateFromStartTs } from "./occurrence.js";

/** Noise tokens stripped before overlap scoring (not display titles). */
const TITLE_MATCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "ca",
  "california",
  "featuring",
  "for",
  "in",
  "live",
  "of",
  "on",
  "presented",
  "the",
  "tour",
  "with",
  "fresno",
  "hanford",
  "clovis"
]);

export interface TitleSimilarityScore {
  /** 0–1 combined score (overlap coefficient weighted toward shared headliner tokens). */
  score: number;
  sharedWords: string[];
  sharedCount: number;
  tokenCountA: number;
  tokenCountB: number;
}

export function significantTitleTokens(title: string): string[] {
  const canonical = canonicalOccurrenceTitle(normalizeTitle(title));
  const tokens = canonical
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !TITLE_MATCH_STOP_WORDS.has(token));

  return [...new Set(tokens)];
}

export function scoreTitleSimilarity(leftTitle: string, rightTitle: string): TitleSimilarityScore {
  const tokensA = significantTitleTokens(leftTitle);
  const tokensB = significantTitleTokens(rightTitle);
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  const sharedWords = tokensA.filter((token) => setB.has(token));
  const sharedCount = sharedWords.length;
  const unionSize = new Set([...tokensA, ...tokensB]).size;
  const minSize = Math.min(tokensA.length, tokensB.length);
  const maxSize = Math.max(tokensA.length, tokensB.length);

  const jaccard = unionSize === 0 ? 0 : sharedCount / unionSize;
  const overlapCoefficient = minSize === 0 ? 0 : sharedCount / minSize;
  const coverage = maxSize === 0 ? 0 : sharedCount / maxSize;

  const score = Math.max(overlapCoefficient, jaccard * 0.85 + coverage * 0.15);

  return {
    score,
    sharedWords,
    sharedCount,
    tokenCountA: tokensA.length,
    tokenCountB: tokensB.length
  };
}

/** Auto-link threshold for ingest fuzzy occurrence matching. */
export function isStrongCrossSourceTitleMatch(score: TitleSimilarityScore): boolean {
  if (score.tokenCountA < 2 || score.tokenCountB < 2) {
    return false;
  }
  // Short headliners ("ZZ Top" vs "ZZ Top Tour"): stop-words leave ≤2 tokens that fully overlap.
  if (score.sharedCount >= 2 && score.score >= 0.95) {
    return true;
  }
  if (score.sharedCount < 3) {
    return false;
  }
  return score.score >= 0.58;
}

/** Admin hint threshold — similar show, not yet linked as duplicate. */
export function isNearCrossSourceTitleMatch(score: TitleSimilarityScore): boolean {
  if (score.sharedCount < 2) {
    return false;
  }
  if (score.tokenCountA < 2 || score.tokenCountB < 2) {
    return false;
  }
  return score.score >= 0.42;
}

export function formatTitleSimilarityLabel(score: TitleSimilarityScore): string {
  const maxTokens = Math.max(score.tokenCountA, score.tokenCountB);
  const pct = maxTokens === 0 ? 0 : Math.round((score.sharedCount / maxTokens) * 100);
  return `${score.sharedCount} shared word${score.sharedCount === 1 ? "" : "s"} · ${pct}% overlap`;
}

export function venueDateLookupKey(venueName: string, startTs: string): string | null {
  const venue = normalizeVenue(venueName);
  const date = pacificDateFromStartTs(startTs);
  if (!venue || !date) {
    return null;
  }
  return `${venue}|${date}`;
}

/** ±36h window around startTs — filter to exact Pacific date in application code. */
export function startTsLookupWindow(startTs: string): { from: string; to: string } | null {
  const instant = new Date(startTs);
  if (Number.isNaN(instant.getTime())) {
    return null;
  }
  const windowMs = 36 * 60 * 60 * 1000;
  return {
    from: new Date(instant.getTime() - windowMs).toISOString(),
    to: new Date(instant.getTime() + windowMs).toISOString()
  };
}

export function samePacificShowDate(leftStartTs: string, rightStartTs: string): boolean {
  const left = pacificDateFromStartTs(leftStartTs);
  const right = pacificDateFromStartTs(rightStartTs);
  return Boolean(left && right && left === right);
}

export function sameNormalizedVenue(leftVenue: string, rightVenue: string): boolean {
  return normalizeVenue(leftVenue) === normalizeVenue(rightVenue);
}
