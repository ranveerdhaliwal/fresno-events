/**
 * Tags that must never be stored on events / candidates.
 * Source kind belongs in `source` / lane columns, not audience-facing tags.
 */
const FORBIDDEN_EVENT_TAGS = new Set(["api"]);

/** Strip forbidden plumbing tags (currently: `api`) before persist. */
export function sanitizeEventTags(tags: readonly string[] | null | undefined): string[] {
  if (!tags?.length) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (FORBIDDEN_EVENT_TAGS.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
