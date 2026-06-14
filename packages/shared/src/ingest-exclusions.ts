/**
 * Hard ingest exclusions — events we never surface in the review queue.
 * Checked at persist and during enrichment so re-scrapes stay rejected.
 */

export interface IngestExclusionInput {
  title: string;
  descriptionText?: string | null;
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
