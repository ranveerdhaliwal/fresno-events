/**
 * Tags safe to show end users. Strips ingest/source plumbing that leaks into
 * event.tags (e.g. "ticketmaster", "venunite_slug:…").
 * Note: "api" is stripped at ingest/persist — not filtered here.
 */

const BLOCKED_EXACT = new Set([
  "ticketmaster",
  "venunite",
  "milb",
  "visitfresno",
  "visitfresnocounty",
  "downtownfresno",
  "gobulldogs",
  "strummers",
  "tower",
  "savemart",
  "source"
]);

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

export function isPublicEventTag(tag: string): boolean {
  const normalized = normalizeTag(tag);
  if (!normalized) {
    return false;
  }
  if (BLOCKED_EXACT.has(normalized)) {
    return false;
  }
  // Internal keyed tags: venunite_slug:…, sport:…, upstream:…
  if (normalized.includes(":")) {
    return false;
  }
  if (normalized.startsWith("upstream") || normalized.startsWith("source")) {
    return false;
  }
  return true;
}

/** Deduped public tags, preserving first-seen order (case-insensitive). */
export function filterPublicEventTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    if (!isPublicEventTag(tag)) {
      continue;
    }
    const key = normalizeTag(tag);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(tag.trim());
  }
  return out;
}

/**
 * Prefer human-facing genre/subcategory labels; fall back to filtered tags.
 */
export function resolvePublicEventTags(input: {
  tags?: readonly string[] | null;
  subcategories?: readonly string[] | null;
}): string[] {
  const fromSubs = filterPublicEventTags(input.subcategories ?? []);
  const fromTags = filterPublicEventTags(input.tags ?? []);
  return filterPublicEventTags([...fromSubs, ...fromTags]);
}
