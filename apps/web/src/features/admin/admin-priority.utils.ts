import { EVENT_PRIORITY_DEFAULT, type EventCandidate } from "@fresno-events/shared";

const PRIORITY_STORAGE_KEY = "wuf:admin_priority";

export function readPriorityOverrides(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(PRIORITY_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    const out: Record<string, number> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5) {
        out[id] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function writePriorityOverrides(overrides: Record<string, number>) {
  try {
    sessionStorage.setItem(PRIORITY_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // ignore
  }
}

export function clearPriorityOverride(id: string, overrides: Record<string, number>): Record<string, number> {
  return clearPriorityOverridesForIds(overrides, [id]);
}

export function clearPriorityOverridesForIds(
  overrides: Record<string, number>,
  ids: Iterable<string>
): Record<string, number> {
  const next = { ...overrides };
  for (const id of ids) {
    delete next[id];
  }
  writePriorityOverrides(next);
  return next;
}

export function suggestedPriorityFor(candidate: EventCandidate): number {
  return candidate.suggestedPriority ?? EVENT_PRIORITY_DEFAULT;
}

export function effectivePriority(
  candidate: EventCandidate,
  overrides: Record<string, number>
): number {
  return overrides[candidate.id] ?? suggestedPriorityFor(candidate);
}

export function seriesGroupKey(candidate: EventCandidate): string | null {
  const seriesId = candidate.normalizedEvent.seriesId?.trim();
  if (seriesId) {
    return `series:${seriesId}`;
  }

  const listingUrl =
    candidate.detailPageUrl?.trim() ||
    candidate.sourceUrl?.trim() ||
    candidate.normalizedEvent.externalUrl?.trim();
  if (!listingUrl) {
    return null;
  }

  try {
    const url = new URL(listingUrl);
    url.hash = "";
    if (url.searchParams.get("format") === "ical") {
      url.search = "";
    }
    return `url:${url.href.replace(/\/+$/, "")}`;
  } catch {
    return `url:${listingUrl.replace(/\/+$/, "")}`;
  }
}

function isSeriesGrouped(candidate: EventCandidate, groupCounts: Map<string, number>): boolean {
  const key = seriesGroupKey(candidate);
  if (!key) {
    return Boolean(candidate.normalizedEvent.seriesName?.trim());
  }
  return (groupCounts.get(key) ?? 0) > 1;
}

export function sortCandidatesForReview(
  items: EventCandidate[],
  overrides: Record<string, number>
): EventCandidate[] {
  const groupCounts = new Map<string, number>();
  for (const item of items) {
    const key = seriesGroupKey(item);
    if (key) {
      groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
    }
  }

  return [...items].sort((a, b) => {
    const groupedA = isSeriesGrouped(a, groupCounts);
    const groupedB = isSeriesGrouped(b, groupCounts);
    if (groupedA !== groupedB) {
      return groupedA ? -1 : 1;
    }

    if (groupedA && groupedB) {
      const keyA = seriesGroupKey(a) ?? "";
      const keyB = seriesGroupKey(b) ?? "";
      if (keyA !== keyB) {
        return keyA.localeCompare(keyB);
      }
      return a.startTs.localeCompare(b.startTs);
    }

    const pa = effectivePriority(a, overrides);
    const pb = effectivePriority(b, overrides);
    if (pa !== pb) {
      return pa - pb;
    }
    return b.confidenceScore - a.confidenceScore;
  });
}

export interface PriorityGroup {
  priority: number;
  items: EventCandidate[];
}

/** Lowest (most prominent) priority among recurring siblings — keeps series in one list section. */
export function buildSeriesDisplayPriorities(
  items: EventCandidate[],
  overrides: Record<string, number>
): Map<string, number> {
  const groupCounts = new Map<string, number>();
  for (const item of items) {
    const key = seriesGroupKey(item);
    if (key) {
      groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
    }
  }

  const byKey = new Map<string, EventCandidate[]>();
  for (const item of items) {
    const key = seriesGroupKey(item);
    if (!key || (groupCounts.get(key) ?? 0) <= 1) {
      continue;
    }
    const bucket = byKey.get(key) ?? [];
    bucket.push(item);
    byKey.set(key, bucket);
  }

  const out = new Map<string, number>();
  for (const cluster of byKey.values()) {
    const unified = Math.min(...cluster.map((item) => effectivePriority(item, overrides)));
    for (const item of cluster) {
      out.set(item.id, unified);
    }
  }
  return out;
}

export function listDisplayPriority(
  candidate: EventCandidate,
  seriesDisplayPriorities: Map<string, number>,
  overrides: Record<string, number>
): number {
  return seriesDisplayPriorities.get(candidate.id) ?? effectivePriority(candidate, overrides);
}

export function groupCandidatesByPriority(
  sorted: EventCandidate[],
  overrides: Record<string, number>,
  seriesDisplayPriorities?: Map<string, number>
): PriorityGroup[] {
  const seriesPriorities = seriesDisplayPriorities ?? buildSeriesDisplayPriorities(sorted, overrides);
  const groups: PriorityGroup[] = [];
  for (const item of sorted) {
    const p = listDisplayPriority(item, seriesPriorities, overrides);
    const last = groups[groups.length - 1];
    if (last && last.priority === p) {
      last.items.push(item);
    } else {
      groups.push({ priority: p, items: [item] });
    }
  }
  return groups;
}
