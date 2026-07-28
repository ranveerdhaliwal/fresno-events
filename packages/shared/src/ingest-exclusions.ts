/**
 * Hard ingest exclusions — events we never surface in the review queue.
 * Checked at persist and during enrichment so re-scrapes stay rejected.
 */

export interface IngestExclusionInput {
  title: string;
  descriptionText?: string | null;
  source?: string | null;
}

const GOBULLDOGS_SOURCE = "api:gobulldogs";
const MILB_SOURCE = "api:milb";

/**
 * Sidearm away games use "{Sport} at {Opponent}". Home/neutral invitational rows use
 * "{Sport}: …" or "{Sport} vs …" and should stay in the queue.
 */
export function isGobulldogsAwayGame(input: IngestExclusionInput): boolean {
  if (input.source !== GOBULLDOGS_SOURCE) {
    return false;
  }

  const title = input.title.trim();
  if (!title) {
    return false;
  }

  // Invitational / multi-team meetups: "Women's Volleyball: UC Irvine vs. …"
  if (/:\s/.test(title)) {
    return false;
  }

  return /\s+at\s+/i.test(title);
}

/**
 * Grizzlies road games ("Fresno Grizzlies at …"). Home stands use "vs".
 * Prefer dropping at scrape time; this catches stale queue rows.
 */
export function isMilbAwayGame(input: IngestExclusionInput): boolean {
  if (input.source !== MILB_SOURCE) {
    return false;
  }

  const title = input.title.trim();
  if (!title) {
    return false;
  }

  return /^fresno grizzlies\s+at\s+/i.test(title);
}

export interface IngestExclusion {
  id: string;
  label: string;
}

const EXCLUSION_RULES: ReadonlyArray<{ id: string; label: string; pattern: RegExp }> = [
  {
    id: "shen-yun",
    label: "Shen Yun (editorial exclusion)",
    pattern: /\bshen\s*yun\b/i
  }
];

/** Returns an exclusion when the listing should be auto-rejected, or null when allowed. */
export function getIngestExclusion(input: IngestExclusionInput): IngestExclusion | null {
  if (isGobulldogsAwayGame(input)) {
    return {
      id: "gobulldogs-away",
      label: "Fresno State away game (out of area)"
    };
  }

  if (isMilbAwayGame(input)) {
    return {
      id: "milb-away",
      label: "Fresno Grizzlies away game (out of area)"
    };
  }

  const blob = `${input.title} ${input.descriptionText ?? ""}`;
  for (const rule of EXCLUSION_RULES) {
    if (rule.pattern.test(blob)) {
      return { id: rule.id, label: rule.label };
    }
  }
  return null;
}

export function formatIngestExclusionNotes(exclusion: IngestExclusion): string {
  return `[ingest] excluded · ${exclusion.label}`;
}
