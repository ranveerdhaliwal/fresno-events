/**
 * Tags that must never be stored on events / candidates.
 * Source kind belongs in `source` / lane columns, not audience-facing tags.
 *
 * Persist-time filter: runs once, before a candidate/event row is written, so
 * `api` never reaches the DB. This is distinct from the display-time filter in
 * `apps/web/src/lib/public-event-tags.utils.ts` (`filterPublicEventTags` /
 * `isPublicEventTag`), which strips additional ingest plumbing (source names,
 * keyed tags like `sport:…`) purely for rendering — it never mutates storage.
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
